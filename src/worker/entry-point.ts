import config from 'config';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { StateMachineRepoMongo } from '../infrastructure/repos/state-machine-repo-mongo';
import { MongoClient } from 'mongodb';
import pino from 'pino';
import { Worker } from './index';

let dbInstance: StateMachineRepoMongo | undefined = undefined;
const logger = pino({
  ...config.get<{
    level: string;
    mixin: (obj: object) => object;
  }>('workerOptions.logger'),
});

const exitHandler = async (
  options: {
    cleanup?: boolean;
    exitCode?: unknown;
    exit?: boolean;
    onShutdown?: () => any;
  },
  exitCode: number,
) => {
  if (options.cleanup) logger.trace('cleanup');
  if (options.exitCode || exitCode === 0)
    logger.trace({ exitCode }, `Exit code ${exitCode}`);
  if (options.exit) {
    logger.info('shutting down.');
    if (dbInstance) {
      await dbInstance.handleAppShutdown();
    }
    if (options.onShutdown) {
      const ret = options.onShutdown();
      if (ret instanceof Promise) {
        return ret;
      }
    }
  }
  return undefined;
};

const wireShutdown = (onShutdown?: () => any) => {
  // do something when app is closing
  process.on('exit', exitHandler.bind(null, { cleanup: true }));

  // catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, { exit: true, onShutdown }));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, { exit: true, onShutdown }));
  process.on('SIGUSR2', exitHandler.bind(null, { exit: true, onShutdown }));

  // catches uncaught exceptions
  process.on('uncaughtException', (ex) => {
    logger.error(ex, 'Uncaught exception');
  });
};

const ensureSystemQueuesExist = async () => {
  const queueNames = ['mds-sm-inFlightQueue', 'mds-sm-pendingQueue'];
  const client = await MdsSdk.getQueueServiceClient();
  const existingQueues = await client.listQueues();

  await Promise.allSettled(
    queueNames.map(async (queueName) => {
      if (!existingQueues.find((queue) => queue.name === queueName)) {
        return client.createQueue(queueName);
      }
      return Promise.resolve();
    }),
  );
};

const launchWorker = async () => {
  const mdsSdkConfig = config.get<Record<string, unknown>>('mdsSdk');
  await MdsSdk.initialize(mdsSdkConfig);
  dbInstance = new StateMachineRepoMongo({
    mongoClient: new MongoClient(config.get<string>('mongo.url'), {
      // TODO: Do we need any options here?
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    }),
    logger,
  });

  wireShutdown(dbInstance.handleAppShutdown);

  await ensureSystemQueuesExist();

  Worker.startWorker().then(() => {
    logger.info('Worker started');
  });
};

(async () => {
  await launchWorker();
})();
