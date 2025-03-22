const _ = require('lodash');
const { MongoClient } = require('mongodb');
const { DateTime } = require('luxon');

const globals = require('../globals');
const enums = require('../enums');

const self = {
  // NOTE: The signatures here may be a bit "funky" since this was originally
  // designed against a relational DB.
  _client: undefined,

  _getDb: async () => {
    if (!self._client) {
      const connOpts = { useNewUrlParser: true, useUnifiedTopology: true };
      const client = await MongoClient(
        globals.getEnvVar('FN_SM_DB_URL', ''),
        connOpts,
      );
      await client.connect();
      self._client = client;
    }

    return self._client.db('mds-sm');
  },

  handleAppShutdown: async () => {
    if (self._client) {
      await self._client.close();
    }
  },

  getStateMachines: async (accountId) => {
    const db = await self._getDb();
    const collection = db.collection('StateMachines');
    const data = await collection
      .find({ accountId, isDeleted: false })
      .toArray();
    // TODO: remove _ keys once mdsCli/mdsSdk has been updated to handle it.
    const result = {};
    data.forEach((sm) => {
      result[sm.name] = {
        name: sm.name,
        id: sm.id,
        active_version: sm.activeVersion,
        activeVersion: sm.activeVersion,
        is_deleted: false,
        isDeleted: false,
      };
    });
    return result;
  },

  createStateMachine: async (id, accountId, name, definitionObject) => {
    const versionId = globals.newUuid();
    const db = await self._getDb();
    const stateMachinesCol = db.collection('StateMachines');

    await stateMachinesCol.insertOne({
      id,
      accountId,
      name,
      activeVersion: versionId,
      isDeleted: false,
      versions: [
        {
          id: versionId,
          definition: definitionObject,
        },
      ],
    });
  },

  getStateMachine: async (id) => {
    const db = await self._getDb();
    const collection = db.collection('StateMachines');
    const data = await collection.findOne({ id, isDeleted: false });
    // TODO: remove _ keys once mdsCli/mdsSdk has been updated to handle it.
    const activeDefinition = _.find(
      data.versions,
      (v) => v.id === data.activeVersion,
    );
    data.definition = activeDefinition.definition;
    return data;
  },

  updateStateMachine: async (id, definitionObject) => {
    const versionId = globals.newUuid();
    const db = await self._getDb();
    const stateMachinesCol = db.collection('StateMachines');
    await stateMachinesCol.updateOne(
      { id },
      {
        $set: { activeVersion: versionId },
        $addToSet: {
          versions: {
            id: versionId,
            definition: definitionObject,
          },
        },
      },
    );
  },

  removeStateMachine: async (id) => {
    // TODO: set up index that will auto-remove the document after the TTL expires
    const db = await self._getDb();
    const stateMachinesCol = db.collection('StateMachines');
    const expires = DateTime.now().plus({ years: 1 });
    await stateMachinesCol.updateOne(
      { id },
      { $set: { isDeleted: true, removeAt: expires } },
    );
  },

  createExecution: async (id, stateMachineId, versionId) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');

    await collection.insertOne({
      id,
      created: new Date().toISOString(),
      status: enums.OP_STATUS.Pending,
      stateMachine: stateMachineId,
      version: versionId,
      operations: [],
    });
  },

  updateExecution: async (id, status) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');
    await collection.updateOne(
      { id },
      {
        $set: { status },
      },
    );
  },

  getExecution: async (id) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');
    const data = await collection.findOne({ id });
    return data;
  },

  getStateMachineDefinitionForExecution: async (id) => {
    // NOTE: Look into using "$lookup" operator
    const db = await self._getDb();
    const executionsCol = db.collection('Executions');
    const stateMachinesCol = db.collection('StateMachines');

    const execution = await executionsCol.findOne({ id });
    const stateMachine = await stateMachinesCol.findOne({
      id: execution.stateMachine,
    });

    const definition = _.find(
      stateMachine.versions,
      (v) => v.id === execution.version,
    );
    return definition.definition;
  },

  getDetailsForExecution: async (id) => {
    // TODO: deprecate this as it's now pointless
    return self.getExecution(id);
  },

  createOperation: async (id, executionId, stateKey, input) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');
    await collection.updateOne(
      { id: executionId },
      {
        $addToSet: {
          operations: {
            id,
            created: new Date().toISOString(),
            stateKey,
            status: enums.OP_STATUS.Pending,
            input,
            output: null,
          },
        },
      },
    );
  },

  updateOperation: async (id, executionId, status, output) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');
    await collection.updateOne(
      { id: executionId, 'operations.id': id },
      {
        $set: {
          'operations.$.status': status,
          'operations.$.output': output,
        },
      },
    );
  },

  delayOperation: async (id, executionId, waitUntilUtc) => {
    // TODO: Consider updating waitUntilUtc to an EPOC
    const db = await self._getDb();
    const collection = db.collection('Executions');
    await collection.updateOne(
      { id: executionId, 'operations.id': id },
      {
        $set: {
          'operations.$.status': enums.OP_STATUS.Waiting,
          'operations.$.waitUntilUtc': waitUntilUtc,
        },
      },
    );
  },

  getOperation: async (id, executionId) => {
    const db = await self._getDb();
    const collection = db.collection('Executions');
    const data = await collection.findOne({ id: executionId });
    const operation = _.find(data.operations, (o) => o.id === id);
    operation.execution = executionId;
    return operation;
  },

  getDelayedOperations: async (waitUntilUtc) => {
    // TODO: Consider updating waitUntilUtc to an EPOC
    // TODO: if there's a better way to do this with a projection try it.
    const db = await self._getDb();
    const collection = db.collection('Executions');
    const sets = [];
    const data = await collection
      .find({
        'operations.waitUntilUtc': { $lt: waitUntilUtc },
      })
      .toArray();

    for (let i = 0; i < data.length; i += 1) {
      const exec = data[i];
      for (let j = 0; j < exec.operations.length; j += 1) {
        const op = exec.operations[j];
        if (
          op.waitUntilUtc &&
          op.status === enums.OP_STATUS.Waiting &&
          op.waitUntilUtc < waitUntilUtc
        ) {
          sets.push({ execution: exec.id, id: op.id });
        }
      }
    }
    // return array of id, execution
    return sets;
  },
};

module.exports = self;
