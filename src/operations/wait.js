const repos = require('../repos');
const enums = require('../enums');
const globals = require('../globals');

const logger = globals.getLogger();

function Wait(definition, metadata) {
  if (definition.Type !== 'Wait') throw new Error(`Attempted to use ${definition.Type} type for "Wait".`);
  this.Seconds = definition.Seconds;
  this.Timestamp = definition.Timestamp;
  this.SecondsPath = definition.SecondsPath;
  this.TimestampPath = definition.TimestampPath;
  this.Next = definition.Next;
  this.operationId = metadata.id;
  this.executionId = metadata.execution;
  this.input = metadata.input;
  this.output = metadata.input;
}

function getValueFromPath(source, path) {
  let tempSource = source;
  const parts = path.split('.');

  parts.forEach((p) => {
    if (p === '$' || !tempSource) return;
    tempSource = tempSource[p];
  });

  return tempSource;
}

function computeWaitTimestamp(that) {
  let ts;
  if (that.Seconds) {
    ts = new Date();
    ts.setSeconds(ts.getSeconds() + Number(that.Seconds));
  }

  if (!ts && that.SecondsPath) {
    ts = new Date();
    ts.setSeconds(ts.getSeconds() + getValueFromPath(that.input, that.SecondsPath));
  }

  if (!ts && that.Timestamp) {
    ts = new Date(that.Timestamp);
  }

  if (!ts && that.TimestampPath) {
    ts = new Date(getValueFromPath(that.input, that.SecondsPath));
  }

  if (!ts) throw new Error('Could not compute timestamp.');
  return ts.toISOString();
}

Wait.prototype.run = function run() {
  this.output = this.input;

  const that = this;
  const {
    operationId,
    executionId,
    output,
    Next,
  } = this;
  return repos.getOperation(operationId)
    .then((opDetails) => {
      if (!opDetails.waitUntilUtc || opDetails.waitUntilUtc > new Date().toISOString()) {
        const afterUtc = opDetails.waitUntilUtc || computeWaitTimestamp(that);
        logger.trace({ operationId, afterUtc }, 'Task entering waiting state.');
        return repos.delayOperation(operationId, afterUtc).then(() => null);
      }

      const nextOpId = globals.newUuid();
      logger.trace({ operationId }, 'Task finished waiting.');
      return repos.updateOperation(operationId, enums.OP_STATUS.Succeeded)
        .then(() => repos.createOperation(nextOpId, executionId, Next, output))
        .then(() => ({
          nextOpId,
          output,
          next: Next,
        }));
    });
};

module.exports = Wait;
