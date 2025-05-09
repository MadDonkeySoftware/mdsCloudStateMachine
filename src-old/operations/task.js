const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');

const globals = require('../globals');
const repos = require('../repos');
const enums = require('../enums');

const logger = globals.getLogger();

function Task(definition, metadata) {
  if (definition.Type !== 'Task')
    throw new Error(`Attempted to use ${definition.Type} type for "Task".`);
  this.resource = definition.Resource;
  this.next = definition.Next;
  this.catchDef = definition.Catch;
  this.operationId = metadata.id;
  this.executionId = metadata.execution;
  this.input = metadata.input;
  this.output = undefined;
}

const handleInvokeResponse = (that, result, err) => {
  const { next, catchDef, input, operationId, executionId } = that;
  const nextOpId = globals.newUuid();

  // TODO: Handle retries / error configurations.
  if (err) {
    // TODO: fnProject does not have a way to return the details of an error when invoking from HTTP
    if (catchDef) {
      for (let i = 0; i < catchDef.length; i += 1) {
        const def = catchDef[i];
        const errs = def.ErrorEquals;
        const errNext = def.Next;
        if (errs.length === 1 && errs[0] === 'States.ALL') {
          logger.trace({ err }, 'Function invoke failed.');
          return repos
            .updateOperation(
              operationId,
              executionId,
              enums.OP_STATUS.Failed,
              input,
            )
            .then(
              () =>
                errNext &&
                repos.createOperation(nextOpId, executionId, errNext, input),
            )
            .then(() => ({
              nextOpId,
              output: input,
              next: errNext,
            }));
        }
      }
    }

    return repos
      .updateOperation(operationId, executionId, enums.OP_STATUS.Failed, input)
      .then(() => repos.updateExecution(executionId, enums.OP_STATUS.Failed))
      .then(() => {
        throw err;
      });
  }

  const output = result;

  return repos
    .updateOperation(
      operationId,
      executionId,
      enums.OP_STATUS.Succeeded,
      output,
    )
    .then(
      () => next && repos.createOperation(nextOpId, executionId, next, output),
    )
    .then(() => ({
      nextOpId,
      output,
      next,
    }));
};

const invokeFunction = async (resource, body) => {
  const client = await mdsSdk.getServerlessFunctionsClient();
  // TODO: Retry logic.ts
  return client.invokeFunction(resource, body);
};

Task.prototype.run = function run() {
  let body = this.input;
  if (body && typeof body === 'object') {
    body = JSON.stringify(body);
  }

  logger.trace({ body }, 'Invoking remote function.');

  return repos
    .updateOperation(
      this.operationId,
      this.executionId,
      enums.OP_STATUS.Executing,
    )
    .then(() => invokeFunction(this.resource, body))
    .then((result) => handleInvokeResponse(this, result))
    .catch((err) => handleInvokeResponse(this, undefined, err));
};

module.exports = Task;
