'use strict';
/**
 * cross-validation/index.js
 * 模块统一出口
 *
 * 使用示例（在主路由挂载时）：
 *   const { streamRouter, PHASE1_SYSTEMS, DIMENSIONS } = require('./lib/cross-validation');
 *   app.use('/api/cross-check', streamRouter);
 *
 * ⚠️ streamRouter 尚未 mount — Phase1 开发完成后由 Karen 统一在 server 入口挂载。
 */

const streamRouter  = require('./streamRoute');
const crossCompare  = require('./crossCompare');
const systemAnalysis = require('./systemAnalysis');
const { PHASE1_SYSTEMS, DIMENSIONS, GROUP_BIRTH, GROUP_MOMENT } = require('./systems');

module.exports = {
  streamRouter,
  crossCompare,
  systemAnalysis,
  PHASE1_SYSTEMS,
  DIMENSIONS,
  GROUP_BIRTH,
  GROUP_MOMENT,
};
