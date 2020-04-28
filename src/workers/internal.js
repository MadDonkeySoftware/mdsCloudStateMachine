const globals = require('../globals');
const repos = require('../repos');
const operations = require('../operations');
const Queue = require('./queue');
const enums = require('../enums');

const internalQueueInterval = process.env.QUEUE_INTERVAL || 50;
const batchProcessingSize = 1;
const pendingQueueName = process.env.PENDING_QUEUE_NAME || 'mds-sm-pendingQueue';
const inFlightQueueName = process.env.IN_FLIGHT_QUEUE_NAME || 'mds-sm-inFlightQueue';
const logger = globals.getLogger();

// This is the general queue that new invocations from the HTTP endpoints are sent to.
// They are lesser priority than in-flight work.
const pendingQueue = new Queue(pendingQueueName);

// This is the queue for executions that are currently in flight. We try to get executions
// that are mid flight out the way before starting "pending" work.
const inFlightQueue = new Queue(inFlightQueueName);

let running = false;
const handleAppShutdown = () => { running = false; };

const handleOpCompleted = (operationId, executionId, runData) => {
  logger.trace({ operationId, executionId, runData: runData || 'N/A' }, 'Handling operation completed');
  if (runData) {
    const { output, nextOpId, next } = runData;
    logger.trace({ operationId, output }, 'Operation completed.');
    return repos.updateOperation(operationId, 'Succeeded', output)
      .then(() => next && inFlightQueue.enqueue({ executionId, operationId: nextOpId }))
      .catch((err) => logger.warn({ err }, 'Set up next operation failed'));
  }

  return Promise.resolve();
};

const buildOperationDataBundle = (metadata) => (
  repos.getStateMachineDefinitionForExecution(metadata.execution)
    .then((definition) => ({ metadata, definition })));

const invokeOperation = (data) => {
  const { definition, metadata } = data;
  const t = operations.getOperation(definition, metadata);
  const operationId = metadata.id;
  const executionId = metadata.execution;

  repos.updateOperation(operationId, 'Executing')
    .then(() => t.run())
    .then((runData) => handleOpCompleted(operationId, executionId, runData))
    .catch((err) => logger.warn({ err }, 'operation run failed'));
};

const processMessage = (message) => {
  logger.trace({ message }, 'Processing message');
  const event = JSON.parse(message.message);
  if (event.fromInvoke) {
    repos.updateExecution(event.executionId, 'Executing');
  }

  repos.getOperation(event.operationId)
    .then((operation) => buildOperationDataBundle(operation))
    .then((data) => invokeOperation(data))
    .catch((err) => logger.warn({ err }, 'process event failed'));
};

const pullMessageFromQueue = (queue, limit, runningData) => {
  const data = runningData || { count: 0 };

  if (data.count < limit) {
    return queue.dequeue().then((message) => {
      // TODO: Deleting the message here may not be the best idea.
      // Entertain moving it to processMessage.
      if (message) {
        return queue.delete(message.id).then(() => message);
      }

      return message;
    }).then((message) => {
      if (message) {
        processMessage(message);
        data.count += 1;
        return pullMessageFromQueue(queue, limit, data);
      }

      data.needMore = true;
      return Promise.resolve(data);
    });
  }

  return Promise.resolve(data);
};

const processMessages = () => {
  /*
  let count = 0;
  if (inFlightQueue.size() > 0) {
    while (count < batchProcessingSize && inFlightQueue.size() > 0) {
      const message = inFlightQueue.dequeue();
      processMessage(message);
      count += 1;
    }
  }

  if (pendingQueue.size() > 0) {
    while (count < batchProcessingSize && pendingQueue.size() > 0) {
      const message = pendingQueue.dequeue();
      processMessage(message);
      count += 1;
    }
  }

  if (running) {
    globals.delay(internalQueueInterval).then(() => processMessages());
  }
  */
  pullMessageFromQueue(inFlightQueue, batchProcessingSize)
    .then((data) => data.needMore && pullMessageFromQueue(pendingQueue, batchProcessingSize, data))
    .then(() => running && globals.delay(internalQueueInterval).then(() => processMessages()));
};

const enqueueDelayedMessages = () => {
  repos.getDelayedOperations(new Date().toISOString()).then((allDelayed) => {
    allDelayed.forEach((delayed) => repos.updateOperation(delayed.id, enums.OP_STATUS.Pending)
      .then(() => inFlightQueue.enqueue({
        executionId: delayed.execution,
        operationId: delayed.id,
      })));
  });

  if (running) {
    globals.delay(internalQueueInterval).then(() => enqueueDelayedMessages());
  }
};

const enqueueMessage = (message) => {
  logger.trace({ message }, 'Enqueueing message');
  return pendingQueue.enqueue(message);
};

const startWorker = () => {
  if (!running) {
    logger.trace('Starting internal worker.');
    running = true;
    globals.delay(internalQueueInterval).then(() => processMessages());
    globals.delay(internalQueueInterval).then(() => enqueueDelayedMessages());
  }
};

module.exports = {
  handleAppShutdown,
  enqueueMessage,
  startWorker,
};
