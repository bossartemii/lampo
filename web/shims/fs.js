'use strict';
// In the browser files are URLs: existence is checked when they load.
module.exports = { existsSync: () => true };
