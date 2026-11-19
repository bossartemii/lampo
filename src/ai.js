'use strict';
// Lampo AI: turns a plain-language brief into a Lampo spec with Claude, the way the skill directs a
// motion designer: route → style → blueprints → spec → validation fix → visual review of a preview.
// Used by Lampo Cloud (mcp/server.js) for "Create with AI". Needs ANTHROPIC_API_KEY.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalize, parseLoose, SpecError } = require('./spec');

const MODEL = process.env.LAMPO_AI_MODEL || 'claude-opus-5-5';
const REF = path.join(__dirname, '../skills/lampo');

let client = null;
function anthropic() {
  if (client) return client;
  let sdk;
  try { sdk = require('@anthropic-ai/sdk'); } catch { throw new Error('Lampo AI needs the @anthropic-ai/sdk package (npm install @anthropic-ai/sdk)'); }
  const Anthropic = sdk.default || sdk;
  client = new Anthropic(); // ANTHROPIC_API_KEY from the environment
  return client;
}

// The frozen system prompt: the Lampo skill and its references. It never changes between requests,
// so it is cached and each generation pays for it at the cache-read rate.
let SYSTEM = null;
function system() {
  if (SYSTEM) return SYSTEM;
  const read = (f) => fs.readFileSync(path.join(REF, f), 'utf8');
  const files = ['SKILL.md', ...fs.readdirSync(path.join(REF, 'references')).filter((f) => f.endsWith('.md')).sort().map((f) => `references/${f}`)];
  const docs = files.map((f) => `<file name="${f}">\n${read(f)}\n</file>`).join('\n\n');
  SYSTEM = [
    {
      type: 'text',
      text: `You are Lampo's motion designer. A customer describes the video they want; you write the Lampo JSON spec that renders it, following the Lampo skill below exactly as a director would: pick the route, one visual style, one blueprint per scene, continuity, sound, then write the spec.

How you answer:
- Reply with the complete spec as one JSON object and nothing else: no prose, no code fence.
- Write all on-screen copy in the language of the brief. Use the brand name, offer and contact the customer gives; never invent prices, phone numbers or addresses they did not give.
- Media: only https:// image or video URLs the customer gives. Without them, design with type, shapes, icons, glow and gradients (no photos).
- Default to 9:16, 10–20 seconds, "sfx": true, unless the brief says otherwise.
- When I send validation errors or a preview image, answer with the corrected complete spec, again as JSON only.

${docs}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
  return SYSTEM;
}

function textOf(message) {
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

function specFrom(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the AI did not return a JSON spec');
  return parseLoose(text.slice(start, end + 1));
}

async function ask(messages) {
  const msg = await anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if a safety classifier declines, the API retries on a fallback model
    system: system(),
    messages,
  }).finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('The AI declined this request. Try describing the video differently.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The AI answer was too long. Ask for a shorter video.');
  return msg;
}

/**
 * Brief → spec. opts: { format, check(spec) → throws if the spec can't be used (e.g. cloud limits),
 * preview(spec) → PNG buffer of keyframes (for the visual review), onStep(name) }.
 * Returns { spec }.
 */
async function generate(brief, opts = {}) {
  const step = (s) => opts.onStep && opts.onStep(s);
  const messages = [{ role: 'user', content: `${opts.format ? `Format: ${opts.format}.\n` : ''}Brief:\n${String(brief).slice(0, 4000)}` }];
  const valid = (spec) => {
    normalize(JSON.parse(JSON.stringify(spec)), { baseDir: os.tmpdir() });
    if (opts.check) opts.check(spec);
  };

  step('writing');
  let reply = await ask(messages);
  let spec = null;
  // up to two repair turns for invalid JSON or validation errors
  for (let attempt = 0; attempt < 3; attempt++) {
    let problem = null;
    try { spec = specFrom(textOf(reply)); valid(spec); }
    catch (e) { problem = e instanceof SpecError ? e.problems.join('\n') : e.message; }
    if (!problem) break;
    if (attempt === 2) throw new Error(`The AI could not produce a valid spec: ${problem}`);
    step('fixing');
    messages.push({ role: 'assistant', content: reply.content });
    messages.push({ role: 'user', content: `The spec has problems. Fix them and send the complete corrected spec:\n${problem}` });
    reply = await ask(messages);
  }

  // visual review: Claude looks at the keyframes, like the skill's review step
  if (opts.preview) {
    step('reviewing');
    try {
      const png = await opts.preview(spec);
      messages.push({ role: 'assistant', content: reply.content });
      messages.push({ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } },
        { type: 'text', text: 'These are keyframes of your spec (3 per scene). Review them with the checklist in references/review.md: cut text, overlaps, empty frames, readability, hierarchy, repetitive motion. Send the complete improved spec (or the same spec if nothing needs to change).' },
      ] });
      const reviewed = await ask(messages);
      const better = specFrom(textOf(reviewed));
      valid(better);
      spec = better;
    } catch (e) {
      // the reviewed version is optional: keep the valid first spec
    }
  }
  step('done');
  return { spec };
}

module.exports = { generate, MODEL };
