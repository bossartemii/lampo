'use strict';
const { render, preview, still } = require('./src/render');
const { normalize, FORMATS } = require('./src/spec');
const { describe } = require('./src/effects');
module.exports = { render, preview, still, validate: normalize, effects: describe, FORMATS };
