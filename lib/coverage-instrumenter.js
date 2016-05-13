'use strict';
var Filter = require('broccoli-filter');
// var Istanbul = require('istanbul');
var Instrumenter = require('./babel-istanbul-instrumenter')

CoverageInstrumenter.prototype = Object.create(Filter.prototype);
CoverageInstrumenter.prototype.constructor = CoverageInstrumenter;
function CoverageInstrumenter(inputNode, options) {
  options = options || {};
  Filter.call(this, inputNode, {
    annotation: options.annotation
  });
}

CoverageInstrumenter.prototype.extensions = ['js'];
CoverageInstrumenter.prototype.targetExtension = 'js';

CoverageInstrumenter.prototype.processString = function(content, relativePath) {
  var instrumenter = new Instrumenter({
    embedSource: true,
    noAutoWrap: true,
    babel: {
      optional: ['es7.decorators'],
      blacklist: ['es6.modules'],
      nonStandard: false,
    }
  });

  return instrumenter.instrumentSync(content, relativePath);
};

module.exports = CoverageInstrumenter;
