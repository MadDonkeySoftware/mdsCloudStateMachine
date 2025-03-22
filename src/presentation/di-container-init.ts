import { Cradle } from '@fastify/awilix';
import { asClass, asFunction, AwilixContainer, Lifetime } from 'awilix';
import config from 'config';
import { MongoClient } from 'mongodb';
import { Logic } from '../core/classes/logic';
import { FastifyInstance } from 'fastify';
import { AuthManager as MdsSdkAuthManager } from '@maddonkeysoftware/mds-cloud-sdk-node/lib/auth-manager';
import { InMemoryCache } from '@maddonkeysoftware/mds-cloud-sdk-node/lib';
import { StateMachineRepoMongo } from '../infrastructure/repos/state-machine-repo-mongo';

/**
 * Documentation available at https://github.com/jeffijoe/awilix
 * @param args the argument object
 * @param args.diContainer The DI container to configure
 * @param args.server The fastify server instance
 */
export function diContainerInit({
  diContainer,
  server,
}: {
  diContainer: AwilixContainer<Cradle>;
  server: FastifyInstance;
}) {
  // NOTE: Keep the keys in alphabetical order to make it easier to find
  diContainer.register({
    logger: asFunction(
      () => {
        return server.log;
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    logic: asClass(Logic, {
      lifetime: Lifetime.SCOPED,
    }),

    mdsAuthManager: asFunction(
      () => {
        const mdsSdkConfig = config.get<Record<string, string>>('mdsSdk');
        return new MdsSdkAuthManager({
          cache: new InMemoryCache(),
          ...mdsSdkConfig,
        });
      },
      {
        lifetime: Lifetime.SINGLETON,
      },
    ),

    mongoClient: asFunction(
      () => {
        return new MongoClient(config.get<string>('mongo.url'), {
          // TODO: Do we need any options here?
          // useNewUrlParser: true,
          // useUnifiedTopology: true,
        });
      },
      {
        lifetime: Lifetime.SCOPED,
        dispose: async (mongoClient) => {
          try {
            await mongoClient.close();
          } catch (err) {
            /* ignore */
          }
        },
      },
    ),

    stateMachineRepo: asClass(StateMachineRepoMongo, {
      lifetime: Lifetime.SCOPED,
    }),
  });

  return Promise.resolve();
}
