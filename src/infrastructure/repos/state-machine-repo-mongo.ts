import { type Collection, type Document, MongoClient } from 'mongodb';
import { BaseLogger } from 'pino';
import config from 'config';
import { v4 } from 'uuid';
import { DateTime } from 'luxon';
import {
  type ExecutionData,
  type StateMachineData,
  StateMachineRepo,
  type Status,
} from '../../core/interfaces/state-machine-repo';
import { StateMachineDefinition } from '../../core/types/state-machine-definition';

const CollectionNames = {
  stateMachines: 'state-machines',
  executions: 'executions',
} as const;

export class BaseRepoMongo {
  readonly #mongoClientInternal;
  readonly #logger;

  constructor({
    mongoClient,
    logger,
  }: {
    mongoClient: MongoClient;
    logger: BaseLogger;
  }) {
    this.#mongoClientInternal = mongoClient;
    this.#logger = logger;
  }

  get #mongoClient() {
    try {
      return this.#mongoClientInternal
        .connect()
        .then(() => this.#mongoClientInternal);
    } catch (err) {
      this.#logger.warn(err, 'Error connecting to mongo');
      throw new Error('Error connecting to mongo');
    }
  }

  protected getCollection<T extends Document>(
    collectionName: string,
  ): Promise<Collection<T>> {
    return (async () => {
      const conn = await this.#mongoClient;
      const db = conn.db(config.get<string>('mongo.db'));
      return db.collection<T>(collectionName);
    })();
  }

  async handleAppShutdown() {
    if (this.#mongoClientInternal) {
      await this.#mongoClientInternal.close();
    }
  }
}

export class StateMachineRepoMongo
  extends BaseRepoMongo
  implements StateMachineRepo
{
  async listStateMachines(accountId: string): Promise<StateMachineData[]> {
    const col = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );

    return await col
      .find({
        accountId,
      })
      .toArray();
  }

  async createStateMachine(
    accountId: string,
    definition: StateMachineDefinition,
  ): Promise<StateMachineData> {
    const col = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );
    const newVersionId = v4();

    const stateMachine: StateMachineData = {
      id: v4(),
      accountId,
      name: definition.Name,
      activeVersion: newVersionId,
      isDeleted: false,
      versions: [
        {
          id: newVersionId,
          definition,
        },
      ],
    };

    await col.insertOne(stateMachine);

    return stateMachine;
  }

  async getStateMachine(
    accountId: string,
    resourceId: string,
  ): Promise<StateMachineData | null> {
    const col = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );

    const stateMachine = await col.findOne({
      id: resourceId,
      accountId,
      isDeleted: false,
    });

    if (!stateMachine) {
      return null;
    }

    return stateMachine;
  }

  async updateStateMachine(
    accountId: string,
    resourceId: string,
    definition: StateMachineDefinition,
  ): Promise<StateMachineData | null> {
    const col = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );
    const newVersionId = v4();

    await col.updateOne(
      {
        id: resourceId,
        accountId,
      },
      {
        $set: {
          activeVersion: newVersionId,
        },
        $addToSet: {
          versions: {
            id: newVersionId,
            definition,
          },
        },
      },
    );

    return this.getStateMachine(accountId, resourceId);
  }

  async removeStateMachine(
    accountId: string,
    resourceId: string,
  ): Promise<void> {
    const col = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );
    const expires = DateTime.now().plus({ years: 1 });

    await col.updateOne(
      {
        id: resourceId,
        accountId,
      },
      {
        $set: {
          isDeleted: true,
          removeAt: expires,
        },
      },
    );
  }

  async createExecution(
    id: string,
    stateMachineId: string,
    versionId: string,
  ): Promise<void> {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    await col.insertOne({
      id,
      created: new Date().toISOString(),
      status: 'Pending',
      stateMachine: stateMachineId,
      version: versionId,
      operations: [],
    });
  }

  async updateExecution(id: string, status: Status): Promise<void> {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    await col.updateOne(
      { id },
      {
        $set: { status },
      },
    );
  }

  async getExecution(id: string): Promise<ExecutionData | null> {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    return await col.findOne({ id });
  }

  async getStateMachineDefinitionForExecution(id: string) {
    const executionsCol = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    const stateMachineCol = await this.getCollection<StateMachineData>(
      CollectionNames.stateMachines,
    );

    const execution = await executionsCol.findOne({ id });
    if (!execution) {
      throw new Error(`Execution ${id} not found`);
    }

    const stateMachine = await stateMachineCol.findOne({
      id: execution.stateMachine,
    });

    const definition = stateMachine?.versions.find(
      (v) => v.id === execution.version,
    )?.definition;

    if (!definition) {
      throw new Error(`Version ${execution.version} not found`);
    }

    return definition;
  }

  /**
   * @deprecated use getExecution instead
   */
  async getDetailsForExecution(id: string) {
    return this.getExecution(id);
  }

  async createOperation(
    id: string,
    executionId: string,
    stateKey: string,
    input: unknown,
  ): Promise<void> {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    await col.updateOne(
      { id: executionId },
      {
        $addToSet: {
          operations: {
            id,
            created: new Date().toISOString(),
            stateKey,
            status: 'Pending',
            input,
            output: null,
          },
        },
      },
    );
  }

  async updateOperation(
    id: string,
    executionId: string,
    status: Status,
    output: unknown,
  ): Promise<void> {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    await col.updateOne(
      { id: executionId, 'operations.id': id },
      {
        $set: {
          'operations.$.status': status,
          'operations.$.output': output,
        },
      },
    );
  }

  async delayOperation(id: string, executionId: string, waitUntilUtc: number) {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    await col.updateOne(
      { id: executionId, 'operations.id': id },
      {
        $set: {
          'operations.$.status': 'Waiting',
          'operations.$.waitUntilUtc': waitUntilUtc,
        },
      },
    );
  }

  async getOperation(id: string, executionId: string) {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    const execution = await col.findOne({ id: executionId });
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const operation = execution.operations.find((o) => o.id === id);
    if (!operation) {
      throw new Error(`Operation ${id} not found`);
    }
    return { ...operation, execution: executionId };
  }

  async getDelayedOperations(waitUntilUtc: number) {
    const col = await this.getCollection<ExecutionData>(
      CollectionNames.executions,
    );
    const sets = [];
    const data = await col
      .find({
        'operations.waitUntilUtc': { $lte: waitUntilUtc },
      })
      .toArray();

    for (let i = 0; i < data.length; i += 1) {
      const execution = data[i];
      for (let j = 0; j < execution.operations.length; j += 1) {
        const op = execution.operations[j];
        if (
          op.waitUntilUtc &&
          op.status === 'Waiting' &&
          op.waitUntilUtc < waitUntilUtc
        ) {
          sets.push({ execution: execution.id, id: op.id });
        }
      }
    }

    return sets;
  }
}
