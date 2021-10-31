const globals = require('../globals');
const repos = require('../repos');
const operations = require('../operations');
const Queue = require('./queue');
const enums = require('../enums');

const internalQueueInterval = process.env.QUEUE_INTERVAL || 50;
const batchProcessingSize = 1;
const logger = globals.getLogger();

const self = {
  /**
   * This is the general queue that new invocations from the HTTP endpoints are sent to.
   * They are lesser priority than in-flight work.
   */
  _pendingQueue: undefined,

  /**
   * This is the queue for executions that are currently in flight. We try to get executions
   * that are mid flight out the way before starting "pending" work.
   */
  _inFlightQueue: undefined,

  /**
   * Indicator for if messages should continue to be processed.
   */
  _running: false,

  /**
   * Handles gracefully telling child processes to stop.
   */
  handleAppShutdown: () => { self._running = false; },

  _handleOpCompleted: async (operationId, executionId, runData) => {
    logger.trace({ operationId, executionId, runData: runData || 'N/A' }, 'Handling operation completed');
    if (runData) {
      const { output, nextOpId, next } = runData;
      logger.trace({ operationId, output }, 'Operation completed.');
      try {
        await repos.updateOperation(operationId, 'Succeeded', output);
        if (next) {
          await self._inFlightQueue.enqueue({ executionId, operationId: nextOpId });
        }
      } catch (err) {
        logger.warn({ err }, 'Set up next operation failed');
      }
    }

    return undefined;
  },

  _buildOperationDataBundle: async (metadata) => {
    const definition = await repos.getStateMachineDefinitionForExecution(metadata.execution);
    return { metadata, definition };
  },

  _invokeOperation: async (data) => {
    const { definition, metadata } = data;
    const t = operations.getOperation(definition, metadata);
    const operationId = metadata.id;
    const executionId = metadata.execution;

    try {
      await repos.updateOperation(operationId, 'Executing');
      const runData = await t.run();
      await self._handleOpCompleted(operationId, executionId, runData);
    } catch (err) {
      logger.warn({ err }, 'operation run failed');
    }
  },

  _processMessage: async (message) => {
    try {
      logger.trace({ message }, 'Processing message');
      const event = JSON.parse(message.message);
      if (event.fromInvoke) {
        repos.updateExecution(event.executionId, 'Executing');
      }

      // TODO: Check to see if execution is cancelled.

      const operation = await repos.getOperation(event.operationId);
      const data = await self._buildOperationDataBundle(operation);
      return self._invokeOperation(data);
    } catch (err) {
      logger.warn({ err }, 'process event failed');
    }
    return undefined;
  },

  _pullMessageFromQueue: async (queue, limit, runningData) => {
    const data = runningData || { count: 0 };

    try {
      if (data.count < limit) {
        const message = await queue.dequeue();
        if (message) {
          // TODO: Deleting the message here may not be the best idea.
          // Entertain moving it to processMessage.
          await queue.delete(message.id);
          self._processMessage(message);
          data.count += 1;
          return self._pullMessageFromQueue(queue, limit, data);
        }
        data.needMore = true;
      }
    } catch (err) {
      // TODO: mdsSdk does not handle the service not being available gracefully
      // For now we ignore errors. Once this is resolved we should remove this try catch.
      data.needMore = true;
    }

    return data;
  },

  _processMessages: async () => {
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
    const data = await self._pullMessageFromQueue(self._inFlightQueue, batchProcessingSize);
    if (data.needMore) {
      await self._pullMessageFromQueue(self._pendingQueue, batchProcessingSize, data);
    }

    if (self._running) {
      await globals.delay(internalQueueInterval);
      self._processMessages();
    }
  },

  _enqueueDelayedMessages: () => {
    repos.getDelayedOperations(new Date().toISOString()).then((allDelayed) => {
      allDelayed.forEach((delayed) => repos.updateOperation(delayed.id, enums.OP_STATUS.Pending)
        .then(() => self._inFlightQueue.enqueue({
          executionId: delayed.execution,
          operationId: delayed.id,
        })));
    });

    if (self._running) {
      globals.delay(internalQueueInterval).then(() => self._enqueueDelayedMessages());
    }
  },

  enqueueMessage: (message) => {
    logger.trace({ message }, 'Enqueueing message');
    return self._pendingQueue.enqueue(message);
  },

  /**
   * Initializes required items and starts the workers internal processes.
   */
  startWorker: async () => {
    if (!self._running) {
      logger.info('Starting worker.');

      self._running = true;
      self._pendingQueue = new Queue(globals.getEnvVar('PENDING_QUEUE_NAME', 'mds-sm-pendingQueue'));
      self._inFlightQueue = new Queue(globals.getEnvVar('IN_FLIGHT_QUEUE_NAME', 'mds-sm-inFlightQueue'));

      globals.delay(internalQueueInterval).then(() => self._processMessages());
      globals.delay(internalQueueInterval).then(() => self._enqueueDelayedMessages());
    }
  },
};

module.exports = self;
