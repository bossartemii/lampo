'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ffmpegPath } = require('./ffmpeg');

function timestampSeconds(value, numericUnit = 'milliseconds') {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return numericUnit === 'seconds' ? value : value / 1000;
  }

  if (typeof value !== 'string') return NaN;

  const match = value.trim().match(
    /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d+)$/
  );

  if (!match) return NaN;

  return Number(match[1] || 0) * 3600
    + Number(match[2]) * 60
    + Number(match[3])
    + Number(`0.${match[4]}`);
}

function parseWhisperJson(data) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const entries = parsed?.transcription || parsed?.segments;

  if (!Array.isArray(entries)) {
    throw new Error('Whisper JSON has no transcription or segments array');
  }

  const segments = [];

  for (const item of entries) {
    const hasOffsets = item?.offsets?.from != null
      && item?.offsets?.to != null;

    const hasTimestamps = item?.timestamps?.from != null
      && item?.timestamps?.to != null;

    const start = hasOffsets
      ? timestampSeconds(item.offsets.from)
      : hasTimestamps
        ? timestampSeconds(item.timestamps.from)
        : timestampSeconds(item?.start, 'seconds');

    const end = hasOffsets
      ? timestampSeconds(item.offsets.to)
      : hasTimestamps
        ? timestampSeconds(item.timestamps.to)
        : timestampSeconds(item?.end, 'seconds');

    const text = typeof item?.text === 'string'
      ? item.text.trim()
      : '';

    if (!text) continue;

    if (
      !Number.isFinite(start)
      || !Number.isFinite(end)
      || start < 0
      || end <= start
    ) {
      throw new Error(
        `Invalid Whisper timestamps for segment: "${text.slice(0, 60)}"`
      );
    }

    segments.push({ start, end, text });
  }

  if (!segments.length) {
    throw new Error('Whisper returned no usable caption segments');
  }

  return segments.sort((a, b) => a.start - b.start);
}

function buildCaptionLayers(segments, options = {}) {
  const style = {
    type: 'text',
    x: '50%',
    y: '82%',
    anchor: 'center',
    align: 'center',
    size: 48,
    weight: 800,
    color: '#ffffff',
    stroke: { color: '#000000', width: 3 },
    bg: { color: 'rgba(0,0,0,0.68)', radius: 14, padding: 12 },
    maxWidth: '88%',
    ...options,
  };

  return segments.map(({ start, end, text }) => ({
    ...style,
    text,
    start,
    end,
  }));
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`${label} not found: "${command}"`);
    }

    throw new Error(`${label} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();

    throw new Error(
      `${label} failed${details ? `: ${details}` : ` (exit ${result.status})`}`
    );
  }

  return result;
}

function transcribeAudio(audioFile, options = {}) {
  if (!audioFile || !fs.existsSync(audioFile)) {
    throw new Error(`Audio file not found: ${audioFile || '(not specified)'}`);
  }

  const model = options.model || process.env.LAMPO_WHISPER_MODEL;

  if (!model) {
    throw new Error(
      'Whisper model not configured. Pass --model /path/to/ggml-base.bin '
      + 'or set LAMPO_WHISPER_MODEL.'
    );
  }

  if (!fs.existsSync(model)) {
    throw new Error(`Whisper model not found: ${model}`);
  }

  const whisper = options.whisper
    || process.env.LAMPO_WHISPER_CLI
    || 'whisper-cli';

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lampo-captions-')
  );

  try {
    const wav = path.join(tempDir, 'audio.wav');
    const prefix = path.join(tempDir, 'transcript');

    run(ffmpegPath(), [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', audioFile,
      '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
      wav,
    ], 'FFmpeg audio conversion');

    run(whisper, [
      '-m', model,
      '-f', wav,
      '-ojf',
      '-of', prefix,
    ], 'whisper.cpp');

    const jsonFile = `${prefix}.json`;

    if (!fs.existsSync(jsonFile)) {
      throw new Error(
        'whisper.cpp completed but did not create its JSON output'
      );
    }

    return parseWhisperJson(fs.readFileSync(jsonFile, 'utf8'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  timestampSeconds,
  parseWhisperJson,
  buildCaptionLayers,
  transcribeAudio,
};
