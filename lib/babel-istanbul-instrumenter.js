'use strict'

var istanbul = require('istanbul')
var babelTransform = require('babel-core').transform
var esprima = require('esprima')
var escodegen = require('escodegen')
var SourceMapConsumer = require('source-map').SourceMapConsumer
var util = require('util')
var _ = require('lodash')

var POSITIONS = ['start', 'end']
var superClass = istanbul.Instrumenter

function Instrumenter (options) {
  istanbul.Instrumenter.call(this, options)
  superClass.call(this, options)

  this.babelOptions = _.assign({
    sourceMap: true,
  }, options && options.babel || {})
}

util.inherits(Instrumenter, superClass)

Instrumenter.prototype.instrumentSync = function (code, fileName) {
  _.assign(this.babelOptions, {
    filename: fileName
  })

  var result = this._r = babelTransform(code, this.babelOptions)
  this._babelMap = new SourceMapConsumer(result.map);

  // PARSE
  var program = esprima.parse(result.code, {
    loc: true,
    range: true,
    tokens: this.opts.preserveComments,
    comment: true,
    sourceType: 'module'
  });

  if (this.opts.preserveComments) {
    program = escodegen
      .attachComments(program, program.comments, program.tokens);
  }

  return this.instrumentASTSync(program, fileName, code);
}

Instrumenter.prototype.getPreamble = function (sourceCode, emitUseStrict) {
  var maps = [['s', 'statementMap'], ['f', 'fnMap'], ['b', 'branchMap']]
  var _this = this
  maps.forEach(function (params) {
    var metricName = params[0]
    var metricMapName = params[1]
    var metrics = _this.coverState[metricName]
    var metricMap = _this.coverState[metricMapName]
    var transformFctName = '_' + metricMapName + 'Transformer'
    var transformedMetricMap = _this[transformFctName](metricMap, metrics)
    _this.coverState[metricMapName] = transformedMetricMap
  })

  return superClass.prototype.getPreamble.call(this, sourceCode, emitUseStrict);
}

Instrumenter.prototype._statementMapTransformer = function (metrics) {
  var _this = this
  return Object.keys(metrics)
    .map(function (index) { return metrics[index] })
    .map(function (statementMeta) {
      return _this._getMetricOriginalLocations([statementMeta])[0]
    })
    .reduce(this._arrayToArrayLikeObject, {})
}

Instrumenter.prototype._fnMapTransformer = function (metrics) {
  var _this = this
  return Object.keys(metrics)
    .map(function (index) { return metrics[index] })
    .map(function (fnMeta) {
      var loc = _this._getMetricOriginalLocations([fnMeta.loc])[0]

      // Force remove the last skip key
      if (fnMeta.skip === undefined) {
        delete fnMeta.skip;
        if (loc.skip !== undefined) {
          fnMeta.skip = loc.skip;
        }
      }

      _.assign(fnMeta, {
        loc: loc
      })
      return fnMeta
    })
    .reduce(this._arrayToArrayLikeObject, {})
}

Instrumenter.prototype._branchMapTransformer = function (metrics) {
  var _this = this
  return Object.keys(metrics)
    .map(function (index) { return metrics[index] })
    .map(function (branchMeta) {
      return _.assign(branchMeta, {
        locations: _this._getMetricOriginalLocations(branchMeta.locations)
      })
    })
    .reduce(this._arrayToArrayLikeObject, {})
}

Instrumenter.prototype._getMetricOriginalLocations = function (metricLocations) {
  metricLocations = metricLocations || []
  // var o = { line: 0, column: 0 }

  var _this = this
  return metricLocations
    .map(function (generatedPositions) {
      return [
        _this._getOriginalPositionsFor(generatedPositions),
        generatedPositions
      ]
    })
    .map(function (params) {
      var start = params[0].start
      var end = params[1].end
      var generatedPosition = params[1]
      var postitions = [start.line, start.column, end.line, end.column]
      var isValid = postitions.every(function (n) { return n !== null })

      // Matches behavior in _fnMapTransformer above.
      if (generatedPosition.skip === undefined) {
        delete generatedPosition.skip;
      }

      var ret = {
        start: start,
        end: end
      }

      isValid ? _.assign(ret, generatedPosition) : _.assign(ret, {skip: true})
      return ret
    })
}

Instrumenter.prototype._getOriginalPositionsFor = function (generatedPositions) {
  generatedPositions = generatedPositions || { start: {}, end: {}}

  var _this = this
  return POSITIONS
    .map(function (position) { return [generatedPositions[position], position]})
    .reduce(function (originalPositions, nextPosition) {
      var generatedPosition = nextPosition[0]
      var position = nextPosition[1]
      var originalPosition = _this._babelMap.originalPositionFor(generatedPosition);
      // remove extra keys
      delete originalPosition.name
      delete originalPosition.source
      originalPositions[position] = originalPosition
      return originalPositions
    }, {})
}

Instrumenter.prototype._arrayToArrayLikeObject = function (arrayLikeObject, item, index) {
  arrayLikeObject[index + 1] = item
  return arrayLikeObject
}

module.exports = Instrumenter
