const repos = require('../repos');
const enums = require('../enums');
const globals = require('../globals');

function Choice(definition, metadata) {
  if (definition.Type !== 'Choice') throw new Error(`Attempted to use ${definition.Type} type for "Choice".`);
  this.resource = definition.Resource;
  this.catch = definition.Catch;
  this.choices = definition.Choices;
  this.defaultOption = definition.Default;
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

function performTest(operation, choice, input) {
  switch (operation) {
    case 'BooleanEquals':
    case 'StringEquals':
    case 'NumericEquals':
    case 'TimestampEquals':
      return getValueFromPath(input, choice.Variable) === choice[operation];

    case 'NumericGreaterThan':
    case 'StringGreaterThan':
    case 'TimestampGreaterThan':
      return getValueFromPath(input, choice.Variable) > choice[operation];

    case 'NumericGreaterThanEquals':
    case 'StringGreaterThanEquals':
    case 'TimestampGreaterThanEquals':
      return getValueFromPath(input, choice.Variable) >= choice[operation];

    case 'NumericLessThan':
    case 'StringLessThan':
    case 'TimestampLessThan':
      return getValueFromPath(input, choice.Variable) < choice[operation];

    case 'NumericLessThanEquals':
    case 'StringLessThanEquals':
    case 'TimestampLessThanEquals':
      return getValueFromPath(input, choice.Variable) <= choice[operation];

    default:
      throw Error(`Condition ${operation} not yet implemented.`);
  }
}

function processChoice(that) {
  const {
    choices,
    defaultOption,
    input,
  } = that;
  let next = null;
  const checks = [
    'And',
    'BooleanEquals',
    'Not',
    'NumericEquals',
    'NumericGreaterThan',
    'NumericGreaterThanEquals',
    'NumericLessThan',
    'NumericLessThanEquals',
    'Or',
    'StringEquals',
    'StringGreaterThan',
    'StringGreaterThanEquals',
    'StringLessThan',
    'StringLessThanEquals',
    'TimestampEquals',
    'TimestampGreaterThan',
    'TimestampGreaterThanEquals',
    'TimestampLessThan',
    'TimestampLessThanEquals',
  ];

  for (let i = 0; i < choices.length; i += 1) {
    const choice = choices[i];
    if (next) break;
    for (let j = 0; j < checks.length; j += 1) {
      const check = checks[j];
      if (Object.prototype.hasOwnProperty.call(choice, check)
          && performTest(check, choice, input)) {
        next = choice.Next;
        break;
      }
    }
  }

  return next || defaultOption;
}

Choice.prototype.run = function run() {
  this.output = this.input;

  const nextOpId = globals.newUuid();
  const {
    operationId,
    executionId,
    output,
  } = this;
  let next;

  return repos.updateOperation(operationId, enums.OP_STATUS.Executing)
    .then(() => processChoice(this))
    .then((nextStateKey) => {
      next = nextStateKey;
      if (next) {
        repos.createOperation(nextOpId, executionId, next, output);
        repos.updateOperation(operationId, enums.OP_STATUS.Succeeded, output);
      } else {
        repos.updateOperation(operationId, enums.OP_STATUS.Failed);
        repos.updateExecution(executionId, enums.OP_STATUS.Failed);
      }
    })
    .then(() => ({
      nextOpId,
      output,
      next,
    }))
    .catch((err) => {
      globals.logger.warn('Failed processing choice step.', { executionId, operationId, err });
      repos.updateOperation(operationId, enums.OP_STATUS.Failed);
      repos.updateExecution(executionId, enums.OP_STATUS.Failed);
    });
};

module.exports = Choice;
