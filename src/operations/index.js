const { logger } = require('../globals');
const Task = require('./task');
const Succeed = require('./succeed');
const Fail = require('./fail');
const Choice = require('./choice');
const Wait = require('./wait');

const getOperation = (definition, metadata) => {
  if (!definition) {
    logger.error('Definition appears falsy. Insufficient information to find operation.');
  }
  if (!metadata) {
    logger.error('Metadata appears falsy. Insufficient information to find operation.');
  }

  const { stateKey } = metadata;
  const currentState = definition.States[stateKey];

  if (!currentState) {
    const availKeys = Object.keys(definition.States).join(',');
    logger.error({ stateKey, availKeys }, 'currentState appears falsy.');
  }

  switch (currentState.Type) {
    case 'Task':
      return new Task(currentState, metadata);
    case 'Succeed':
      return new Succeed(currentState, metadata);
    case 'Fail':
      return new Fail(currentState, metadata);
    case 'Choice':
      return new Choice(currentState, metadata);
    case 'Wait':
      return new Wait(currentState, metadata);
    default:
      break;
  }

  throw new Error(`Attempted to use unknown operation type: ${stateKey}.`);
};

module.exports = {
  getOperation,
};
