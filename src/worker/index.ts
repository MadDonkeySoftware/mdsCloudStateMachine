import pino, { BaseLogger } from 'pino';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { QueueServiceClient } from '@maddonkeysoftware/mds-cloud-sdk-node/clients';
import { StateMachineRepo } from '../core/interfaces/state-machine-repo';
import { StateMachineRepoMongo } from '../infrastructure/repos/state-machine-repo-mongo';
import { MongoClient } from 'mongodb';
import config from 'config';
import { StateMachineDefinition } from '../core/types/state-machine-definition';
import { getOperation } from '../core/operations';

const toEpoch = (ts: Date) => Math.floor(ts.getTime() / 1000);
const BATCH_PROCESSING_SIZE = 1;
type ExecutionMetadata = {
  id: string;
  execution: string;
  input: unknown;
  output: unknown;
  stateKey: string;
};
type RunningData = {
  count: number;
  needMore: boolean;
};

export class Worker {
  static #queueClient: QueueServiceClient;
  static #stateMachineRepo: StateMachineRepo;
  static #running: boolean = false;
  static #logger: BaseLogger;

  static get #queueInterval(): number {
    return parseInt(process.env.QUEUE_INTERVAL ?? '1000', 10);
  }

  static #delay(timeout: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, timeout);
    });
  }

  static handleAppShutdown() {
    this.#running = false;
  }

  static async #handleOpCompleted(
    operationId: string,
    executionId: string,
    runData: any, // TODO: Define runData type
  ) {
    this.#logger.trace(
      { operationId, executionId, runData: runData || 'N/A' },
      'Handling operation completed',
    );

    if (runData) {
      const { output, nextOpId, next } = runData;
      this.#logger.trace({ operationId, output }, 'Operation completed');
      try {
        await this.#stateMachineRepo.updateOperation(
          operationId,
          executionId,
          'Succeeded',
          output,
        );

        if (next) {
          const message = { executionId, operationId: nextOpId };
          await this.#queueClient.enqueueMessage(
            process.env.IN_FLIGHT_QUEUE_NAME ??
              'IN_FLIGHT_QUEUE_NAME environment variable not set',
            message,
          );
        }
      } catch (err) {
        /* istanbul ignore next */
        this.#logger.warn({ err }, 'Set up of next operation failed');
      }
    }

    return undefined;
  }

  static async #buildOperationDataBundle(metadata: ExecutionMetadata) {
    const definition =
      await this.#stateMachineRepo.getStateMachineDefinitionForExecution(
        metadata.execution,
      );
    return { metadata, definition };
  }

  static async #invokeOperation(data: {
    metadata: ExecutionMetadata;
    definition: StateMachineDefinition | null;
  }) {
    const { definition, metadata } = data;
    /* istanbul ignore if */
    if (!definition) {
      this.#logger.warn({ metadata }, 'No definition found for operation id');
      return;
    }

    const t = getOperation(
      definition,
      metadata,
      this.#logger,
      this.#stateMachineRepo,
    );

    /* istanbul ignore if */
    if (!t) {
      this.#logger.warn({ metadata }, 'No operation found for operation id');
      return;
    }

    try {
      await this.#stateMachineRepo.updateOperation(
        metadata.id,
        metadata.execution,
        'Executing',
        undefined,
      );
      const runData = await t.run();
      await this.#handleOpCompleted(metadata.id, metadata.execution, runData);
    } catch (err) {
      this.#logger.warn({ err }, 'Failed to execute operation');
    }
  }

  static async #processMessage(message: { message: string }) {
    try {
      this.#logger.trace('Processing message');
      const event = JSON.parse(message.message);
      if (event.fromInvoke) {
        await this.#stateMachineRepo.updateExecution(
          event.executionId,
          'Executing',
        );
      }

      // TODO: Check to see if execution is cancelled.

      const operation = await this.#stateMachineRepo.getOperation(
        event.operationId,
        event.executionId,
      );

      /* istanbul ignore if */
      if (!operation) {
        this.#logger.warn({ message }, 'Operation not found');
        return;
      }

      const data = await this.#buildOperationDataBundle(operation);
      return this.#invokeOperation(data);
    } catch (err) {
      /* istanbul ignore next */
      this.#logger.warn({ err }, 'process event failed');
    }
    return undefined;
  }

  static async #pullMessageFromQueue(
    queueOrid: string,
    limit: number,
    runningData: RunningData | undefined,
  ): Promise<RunningData> {
    const data: RunningData = runningData || { count: 0, needMore: false };
    try {
      if (data.count < limit) {
        const message = await this.#queueClient.fetchMessage(queueOrid);
        if (message) {
          // TODO: Deleting the message here may not be the best idea.
          // Entertain moving it to processMessage.
          await this.#queueClient.deleteMessage(queueOrid, message.id);
          void this.#processMessage(message);
          data.count += 1;
          return this.#pullMessageFromQueue(queueOrid, limit, data);
        }
        data.needMore = true;
      }
    } catch (err) {
      // TODO: MdsSdk does not handle the service not being available gracefully
      // For now we ignore errors. Once this is resolved we should remove this try catch.
      data.needMore = true;
    }

    return data;
  }

  static async #processMessages() {
    const data = await this.#pullMessageFromQueue(
      process.env.IN_FLIGHT_QUEUE_NAME ||
        'IN_FLIGHT_QUEUE_NAME environment variable not set',
      BATCH_PROCESSING_SIZE,
      undefined,
    );

    if (data.needMore) {
      await this.#pullMessageFromQueue(
        process.env.PENDING_QUEUE_NAME ||
          'PENDING_QUEUE_NAME environment variable not set',
        BATCH_PROCESSING_SIZE,
        data,
      );
    }

    if (this.#running) {
      await this.#delay(this.#queueInterval);
      this.#processMessages();
    }
  }

  static async #enqueueDelayedMessages() {
    const allDelayed = await this.#stateMachineRepo.getDelayedOperations(
      toEpoch(new Date()),
    );
    await Promise.all(
      allDelayed.map(async (delayed) => {
        await this.#stateMachineRepo.updateOperation(
          delayed.id,
          delayed.execution,
          'Pending',
          undefined,
        );
        await this.#queueClient.enqueueMessage(
          process.env.IN_FLIGHT_QUEUE_NAME ||
            'PENDING_QUEUE_NAME environment variable not set',
          {
            executionId: delayed.execution,
            operationId: delayed.id,
          },
        );
      }),
    );

    if (this.#running) {
      await this.#delay(this.#queueInterval);
      this.#enqueueDelayedMessages();
    }
  }

  static enqueueMessage(message: unknown) {
    this.#logger.trace({ message }, 'Enqueuing message');
    return this.#queueClient.enqueueMessage(
      process.env.PENDING_QUEUE_NAME ||
        'PENDING_QUEUE_NAME environment variable not set',
      message,
    );
  }

  /**
   * Initializes required items and starts the workers internal processes.
   * @param args - Optional arguments used to override defaults for testing.
   * @param args.queueClient - Optional queue client to use.
   * @param args.stateMachineRepo - Optional state machine repo to use.
   * @param args.logger - Optional logger to use.
   */
  static async startWorker({
    queueClient,
    stateMachineRepo,
    logger,
  }: {
    queueClient?: QueueServiceClient;
    stateMachineRepo?: StateMachineRepo;
    logger?: BaseLogger;
  } = {}) {
    if (this.#running) {
      return;
    }

    this.#logger =
      logger ??
      pino({
        ...config.get<{
          level: string;
          mixin: (obj: object) => object;
        }>('workerOptions.logger'),
      });

    this.#logger.info('Starting worker');
    this.#running = true;
    try {
      this.#queueClient = queueClient || (await MdsSdk.getQueueServiceClient());
    } catch (err) {
      this.#logger.error({ err }, 'Failed to initialize queue client');
      this.#running = false;
      return;
    }
    this.#stateMachineRepo =
      stateMachineRepo ??
      new StateMachineRepoMongo({
        mongoClient: new MongoClient(config.get<string>('mongo.url'), {
          // TODO: Do we need any options here?
          // useNewUrlParser: true,
          // useUnifiedTopology: true,
        }),
        logger: this.#logger,
      });

    // TODO: Start processing
    this.#delay(this.#queueInterval).then(() => this.#processMessages());
    this.#delay(this.#queueInterval).then(() => this.#enqueueDelayedMessages());
  }
}

export default Worker;
