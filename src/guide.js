'use strict';
// The agent-facing docs: the spec reference plus the skill's direction references
// (routes, styles, blueprints, motion rules, review). Same content for the skill, MCP and CLI.
const fs = require('fs');
const path = require('path');

const REF = path.join(__dirname, '../skills/lampo/references');
const TOPICS = {
  spec: path.join(__dirname, 'guide.md'),
  routes: path.join(REF, 'categories.md'),
  styles: path.join(REF, 'visual-styles.md'),
  blueprints: path.join(REF, 'blueprints.md'),
  motion: path.join(REF, 'motion-principles.md'),
  review: path.join(REF, 'review.md'),
};

const INDEX = `## More guides (lampo_guide topic / lampo guide <topic>)
- routes: what kind of video it is → length, scenes, copy structure, blueprint sequence
- styles: 9 named visual styles (palette, type, motion, transitions) with runnable samples
- blueprints: 16 time-coded shot templates with JSON (kinetic slam, morph lockup, app demo, camera pan…)
- motion: easing, speed, choreography, continuity, composition and sound rules
- review: proof frames, checklist, common defects → fixes
Flow: intent → route → style + one blueprint per scene → spec → preview with proof times → fix → render.`;

function guide(topic = 'spec') {
  if (topic === 'all') return Object.keys(TOPICS).map((k) => fs.readFileSync(TOPICS[k], 'utf8')).join('\n\n---\n\n');
  const file = TOPICS[topic];
  if (!file) throw new Error(`unknown guide topic "${topic}". Topics: ${[...Object.keys(TOPICS), 'all'].join(', ')}`);
  const md = fs.readFileSync(file, 'utf8');
  return topic === 'spec' ? `${md}\n\n${INDEX}` : md;
}

module.exports = { guide, TOPICS: [...Object.keys(TOPICS), 'all'] };
