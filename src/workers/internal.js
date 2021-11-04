const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');

const globals = require('../globals');
const repos = require('../repos');
const operations = require('../operations');
const enums = require('../enums');

const internalQueueInterval = process.env.QUEUE_INTERVAL || 50;
const batchProcessingSize = 1;
const logger = globals.getLogger();

const self = {
  /**
   * The mds queue client used for queue interactions.
   */
  _queueClient: undefined,

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
          const message = { executionId, operationId: nextOpId };
          await self._queueClient.enqueueMessage(globals.getEnvVar('IN_FLIGHT_QUEUE_NAME'), message);
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

  _pullMessageFromQueue: async (queueOrid, limit, runningData) => {
    const data = runningData || { count: 0 };

    try {
      if (data.count < limit) {
        const message = await self._queueClient.fetchMessage(queueOrid);
        if (message) {
          // TODO: Deleting the message here may not be the best idea.
          // Entertain moving it to processMessage.
          await self._queueClient.deleteMessage(queueOrid, message.id);
          self._processMessage(message);
          data.count += 1;
          return self._pullMessageFromQueue(queueOrid, limit, data);
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
    const data = await self._pullMessageFromQueue(
      globals.getEnvVar('IN_FLIGHT_QUEUE_NAME'),
      batchProcessingSize,
    );

    if (data.needMore) {
      await self._pullMessageFromQueue(
        globals.getEnvVar('PENDING_QUEUE_NAME'),
        batchProcessingSize,
        data,
      );
    }

    if (self._running) {
      await globals.delay(internalQueueInterval);
      self._processMessages();
    }
  },

  _enqueueDelayedMessages: async () => {
    const allDelayed = await repos.getDelayedOperations(new Date().toISOString());
    allDelayed.forEach((delayed) => repos.updateOperation(delayed.id, enums.OP_STATUS.Pending)
      .then(() => self._queueClient.enqueueMessage(
        globals.getEnvVar('IN_FLIGHT_QUEUE_NAME'),
        {
          executionId: delayed.execution,
          operationId: delayed.id,
        },
      )));

    if (self._running) {
      globals.delay(internalQueueInterval).then(() => self._enqueueDelayedMessages());
    }
  },

  enqueueMessage: async (message) => {
    logger.trace({ message }, 'Enqueueing message');
    return self._client.enqueueMessage(globals.getEnvVar('PENDING_QUEUE_NAME'), message);
  },

  /**
   * Initializes required items and starts the workers internal processes.
   */
  startWorker: async () => {
    if (!self._running) {
      logger.info('Starting worker.');

      if (!globals.getEnvVar('PENDING_QUEUE_NAME')) {
        throw new Error('Pending queue ORID missing. Please set environment variable PENDING_QUEUE_NAME');
      }

      if (!globals.getEnvVar('IN_FLIGHT_QUEUE_NAME')) {
        throw new Error('Pending queue ORID missing. Please set environment variable IN_FLIGHT_QUEUE_NAME');
      }

      self._running = true;
      self._queueClient = await mdsSdk.getQueueServiceClient();

      globals.delay(internalQueueInterval).then(() => self._processMessages());
      globals.delay(internalQueueInterval).then(() => self._enqueueDelayedMessages());
    }
  },
};

module.exports = self;
