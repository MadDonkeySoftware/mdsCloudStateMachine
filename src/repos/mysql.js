const mysql = require('mysql2/promise');
const mysqlParse = require('mysql-parse');

const globals = require('../globals');
const enums = require('../enums');

const mapTypeForReturn = (typeString, data) => {
  switch (typeString) {
    case 'object':
      if (data) {
        return JSON.parse(data);
      }
      return null;
    case 'boolean':
      return Boolean(data);
    case 'number':
      return Number(data);
    case 'string':
      return data;
    case null:
      return data;
    default:
      globals.logger.warn('Encountered unknown map type. Returning data as-is.', typeString);
      return data;
  }
};

const mapTypeForStorage = (data) => {
  if (data === null || data === undefined) {
    return {
      type: 'object',
      data: null,
    };
  }

  const type = typeof data;
  switch (type) {
    case 'object':
      return {
        type,
        data: JSON.stringify(data),
      };
    default:
      return {
        type,
        data,
      };
  }
};

const mapResultSetToArray = (results) => {
  const retData = [];

  results[0].forEach((e) => {
    const mapped = {};
    results[1].forEach((c) => {
      mapped[c.name] = e[c.name];
    });
    retData.push(mapped);
  });

  return retData;
};

const mapResultSetToObject = (results) => {
  if (results[0].length === 0) {
    return {};
  }

  if (results[0].length > 1) {
    throw new Error('Result set contains more than one element');
  }

  const retData = {};
  const elem = results[0][0];

  results[1].forEach((c) => {
    retData[c.name] = elem[c.name];
  });

  return retData;
};

let internalDb;
const getDb = () => {
  if (!internalDb) {
    globals.logger.debug('Initializing mysql database');
    const opts = mysqlParse.parseUri(process.env.FN_SM_DB_URL);
    delete opts.scheme;
    return mysql.createConnection(opts)
      .then((conn) => {
        internalDb = conn;
        internalDb.config.namedPlaceholders = true;
        return internalDb;
      })
      .catch((err) => {
        globals.logger.error('Failed to create database', err);
        throw err;
      });
  }

  const db = internalDb;
  return Promise.resolve(db);
};

const getStateMachines = (db) => db.execute('SELECT * FROM StateMachine')
  .then((result) => mapResultSetToArray(result));

const createStateMachine = (db, id, name, definitionObject) => {
  const versionId = globals.newUuid();
  return db.execute('INSERT INTO StateMachineVersion VALUES (:id, :definition)', { id: versionId, definition: JSON.stringify(definitionObject) })
    .then(() => db.execute('INSERT INTO StateMachine VALUES (:id, :name, :active_version)', { id, name, active_version: versionId }));
};

const updateStateMachine = (db, id, definitionObject) => {
  const versionId = globals.newUuid();
  return db.execute('INSERT INTO StateMachineVersion VALUES (:id, :definition)', { id: versionId, definition: JSON.stringify(definitionObject) })
    .then(() => db.execute('UPDATE StateMachine SET active_version = :active_version WHERE id = :id', { id, active_version: versionId }));
};

const getStateMachine = (db, id) => db.execute('SELECT * FROM StateMachine WHERE id = :id', { id })
  .then((results) => mapResultSetToObject(results))
  .then((stateMachine) => db.execute('SELECT * FROM StateMachineVersion WHERE id = :id', { id: stateMachine.active_version })
    .then((results) => ({ stateMachine, stateMachineVersion: mapResultSetToObject(results) })))
  .then((data) => ({
    ...data.stateMachine,
    definition: JSON.parse(data.stateMachineVersion.definition),
  }))
  .catch((err) => {
    globals.logger.warn('Error during execution', err);
  });

const createExecution = (db, id, versionId) => db.execute('INSERT INTO Execution VALUES (:id, :created, :status, :version)', {
  id,
  created: new Date().toISOString(),
  status: enums.OP_STATUS.Pending,
  version: versionId,
});

const updateExecution = (db, id, status) => db.execute('UPDATE Execution SET status = :status WHERE id = :id', { status, id });

const getExecution = (db, id) => db.execute('SELECT * FROM Execution WHERE id = :id', { id })
  .then((results) => mapResultSetToObject(results));

const getStateMachineDefinitionForExecution = (db, id) => db.execute('SELECT smv.definition FROM Execution AS e JOIN StateMachineVersion AS smv ON e.version = smv.id WHERE e.id = :executionId', { executionId: id })
  .then((result) => mapResultSetToObject(result))
  .then((result) => JSON.parse(result.definition));

const getDetailsForExecution = (db, id) => db.execute('SELECT e.status AS executionStatus, o.* FROM Execution AS e JOIN Operation AS o ON e.id = o.execution WHERE e.id = :executionId', { executionId: id })
  .then((results) => mapResultSetToArray(results))
  .then((results) => ({
    id,
    status: results[0] ? results[0].executionStatus : 'unknown',
    operations: results.map((e) => {
      const inputData = mapTypeForReturn(e.inputType, e.input);
      const outputData = mapTypeForReturn(e.outputType, e.output);
      return {
        id: e.id,
        created: e.created,
        status: e.status,
        stateKey: e.stateKey,
        input: inputData,
        output: outputData,
      };
    }),
  }));

const createOperation = (db, id, executionId, stateKey, input) => {
  const inputMap = mapTypeForStorage(input);
  return db.execute('INSERT INTO Operation VALUES (:id, :executionId, :created, :stateKey, :status, :input, :inputType, :output, :outputType, NULL)', {
    id,
    executionId,
    created: new Date().toISOString(),
    stateKey,
    status: enums.OP_STATUS.Pending,
    input: inputMap.data,
    inputType: inputMap.type,
    output: null,
    outputType: null,
  });
};

const updateOperation = (db, id, status, output) => {
  const outputMap = mapTypeForStorage(output);
  return db.execute('UPDATE Operation SET status = :status, output = :output, outputType = :outputType WHERE id = :id', {
    status,
    output: outputMap.data,
    outputType: outputMap.type,
    id,
  });
};

const delayOperation = (db, id, waitUntilUtc) => db.execute('UPDATE Operation SET status = :status, waitUntilUtc = :waitUntilUtc WHERE id = :id', {
  status: enums.OP_STATUS.Waiting,
  waitUntilUtc,
  id,
});

const getOperation = (db, id) => db.execute('SELECT * FROM Operation WHERE id = :id', { id })
  .then((result) => mapResultSetToObject(result))
  .then((result) => {
    const inputMap = mapTypeForReturn(result.inputType, result.input);
    const outputMap = mapTypeForReturn(result.outputType, result.output);
    const {
      execution, created, stateKey, status, waitUntilUtc,
    } = result;
    return {
      id,
      execution,
      created,
      stateKey,
      status,
      input: inputMap,
      output: outputMap,
      waitUntilUtc,
    };
  });

const getDelayedOperations = (db, waitUntilUtc) => db.execute('SELECT * FROM Operation WHERE status = :status AND waitUntilUtc < :waitUntilUtc', {
  status: enums.OP_STATUS.Waiting,
  waitUntilUtc,
}).then((result) => mapResultSetToArray(result));

module.exports = {
  getDb,
  getStateMachines,
  createStateMachine,
  getStateMachine,
  updateStateMachine,
  createExecution,
  updateExecution,
  getExecution,
  getStateMachineDefinitionForExecution,
  getDetailsForExecution,
  createOperation,
  updateOperation,
  delayOperation,
  getOperation,
  getDelayedOperations,
};
