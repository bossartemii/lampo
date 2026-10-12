'use strict';
const { render, preview, still } = require('./src/render');
const { normalize, FORMATS } = require('./src/spec');
const { describe } = require('./src/effects');
const { SOUND_NAMES } = require('./src/sfx');
module.exports = { render, preview, still, validate: normalize, effects: () => ({ ...describe(), sounds: SOUND_NAMES }), FORMATS };
