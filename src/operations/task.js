const axios = require('axios');

const globals = require('../globals');
const repos = require('../repos');
const enums = require('../enums');

const logger = globals.getLogger();

function Task(definition, metadata) {
  if (definition.Type !== 'Task') throw new Error(`Attempted to use ${definition.Type} type for "Task".`);
  this.resource = definition.Resource;
  this.next = definition.Next;
  this.catchDef = definition.Catch;
  this.operationId = metadata.id;
  this.executionId = metadata.execution;
  this.input = metadata.input;
  this.output = undefined;
}

const handleInvokeResponse = (that, response) => {
  const {
    next,
    catchDef,
    input,
    operationId,
    executionId,
  } = that;
  const nextOpId = globals.newUuid();

  // TODO: Handle retries / error configurations.
  if (response.status !== 200) {
    // TODO: fnProject does not have a way to return the details of an error when invoking from HTTP
    if (catchDef) {
      for (let i = 0; i < catchDef.length; i += 1) {
        const def = catchDef[i];
        const errs = def.ErrorEquals;
        const errNext = def.Next;
        if (errs.length === 1 && errs[0] === 'States.ALL') {
          logger.trace({ status: response.status, body: response.data }, 'Function invoke failed.');
          return repos.updateOperation(operationId, enums.OP_STATUS.Failed, input)
            .then(() => errNext && repos.createOperation(nextOpId, executionId, errNext, input))
            .then(() => ({
              nextOpId,
              output: input,
              next: errNext,
            }));
        }
      }
    }

    return repos.updateOperation(operationId, enums.OP_STATUS.Failed, input)
      .then(() => repos.updateExecution(executionId, enums.OP_STATUS.Failed))
      .then(() => {
        throw new Error(response.data);
      });
  }

  const output = response.data;

  return repos.updateOperation(operationId, enums.OP_STATUS.Succeeded, output)
    .then(() => next && repos.createOperation(nextOpId, executionId, next, output))
    .then(() => ({
      nextOpId,
      output,
      next,
    }));
};

const invokeFunction = (resource, body) => {
  const postOptions = {
    headers: {
      'content-type': 'application/json',
    },
    validateStatus: () => true, // Don't reject on any request
  };

  return axios.post(resource, body, postOptions);
};

Task.prototype.run = function run() {
  let body = this.input;
  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  logger.trace({ body }, 'Invoking remote function.');

  return repos.updateOperation(this.operationId, enums.OP_STATUS.Executing)
    .then(() => invokeFunction(this.resource, body))
    .then((resp) => handleInvokeResponse(this, resp));
};

module.exports = Task;
