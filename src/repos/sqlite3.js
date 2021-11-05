const sqlite = require('sqlite');

const globals = require('../globals');
const enums = require('../enums');

const logger = globals.getLogger();

const createOperationTableSql = `
CREATE TABLE IF NOT EXISTS Operation (
    id           TEXT PRIMARY KEY,
    execution    TEXT NOT NULL,
    created      TEXT NOT NULL,
    stateKey     TEXT NOT NULL,
    status       TEXT NOT NULL,
    input        TEXT,
    inputType    TEXT,
    output       TEXT,
    outputType   TEXT,
    waitUntilUtc TEXT,
  FOREIGN KEY (execution) REFERENCES Execution (id) ON DELETE CASCADE
) WITHOUT ROWID;
`;

const createExecutionTableSql = `
CREATE TABLE IF NOT EXISTS Execution (
    id      TEXT PRIMARY KEY,
    created TEXT NOT NULL,
    status  TEXT NOT NULL,
    version TEXT NOT NULL,
  FOREIGN KEY (version) REFERENCES StateMachineVersion (id) ON DELETE CASCADE
) WITHOUT ROWID;
`;

const createStateMachineVersionTableSql = `
CREATE TABLE IF NOT EXISTS StateMachineVersion (
    id         TEXT PRIMARY KEY,
    definition TEXT NOT NULL
) WITHOUT ROWID;
`;

const createStateMachineTableSql = `
CREATE TABLE IF NOT EXISTS StateMachine (
    id             TEXT PRIMARY KEY,
    account_id     TEXT NOT NULL,
    name           TEXT NOT NULL,
    active_version TEXT NOT NULL,
  FOREIGN KEY (active_version) REFERENCES StateMachineVersion (id) ON DELETE CASCADE
) WITHOUT ROWID;
`;

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
      logger.warn(
        { typeString },
        'Encountered unknown map type. Returning data as-is.',
      );
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

let internalDb;
const getDb = () => {
  if (!internalDb) {
    logger.debug('Initializing in-memory database');

    const database = sqlite.open(':memory:', { Promise });

    return database.then((dbObj) => {
      internalDb = dbObj;
      return dbObj
        .run(createStateMachineVersionTableSql)
        .then(() => dbObj.run(createStateMachineTableSql))
        .then(() => dbObj.run(createExecutionTableSql))
        .then(() => dbObj.run(createOperationTableSql))
        .then(() => logger.debug('in-memory database initialized.'))
        .then(() => dbObj)
        .catch((err) => {
          logger.error({ err }, 'Failed to create database');
          throw err;
        });
    });
  }

  const db = internalDb;
  return Promise.resolve(db);
};

const getStateMachines = (db, accountId) =>
  db.all('SELECT * FROM StateMachine WHERE account_id = $accountId', {
    accountId,
  });

const createStateMachine = (db, id, accountId, name, definitionObject) => {
  const versionId = globals.newUuid();
  return db
    .run('INSERT INTO StateMachineVersion VALUES ($id, $definition)', {
      $id: versionId,
      $definition: JSON.stringify(definitionObject),
    })
    .then(() =>
      db.run(
        'INSERT INTO StateMachine VALUES ($id, $account_id, $name, $active_version)',
        {
          $id: id,
          $account_id: accountId,
          $name: name,
          $active_version: versionId,
        },
      ),
    );
};
const updateStateMachine = (db, id, definitionObject) => {
  const versionId = globals.newUuid();
  return db
    .run('INSERT INTO StateMachineVersion VALUES ($id, $definition)', {
      $id: versionId,
      $definition: JSON.stringify(definitionObject),
    })
    .then(() =>
      db.run(
        'UPDATE StateMachine SET active_version = $active_version WHERE id = $id',
        { $id: id, $active_version: versionId },
      ),
    );
};

const getStateMachine = (db, id) =>
  db
    .get('SELECT * FROM StateMachine WHERE id = $id', { $id: id })
    .then((stateMachine) =>
      db
        .get('SELECT * FROM StateMachineVersion WHERE id = $id', {
          $id: stateMachine.active_version,
        })
        .then((stateMachineVersion) => ({ stateMachine, stateMachineVersion })),
    )
    .then((data) => ({
      ...data.stateMachine,
      definition: JSON.parse(data.stateMachineVersion.definition),
    }))
    .catch((err) => {
      logger.warn({ err }, 'Error during execution');
    });

const createExecution = (db, id, versionId) =>
  db.run('INSERT INTO Execution VALUES ($id, $created, $status, $version)', {
    $id: id,
    $created: new Date().toISOString(),
    $status: enums.OP_STATUS.Pending,
    $version: versionId,
  });
const updateExecution = (db, id, status) =>
  db.run('UPDATE Execution SET status = $status WHERE id = $id', {
    $status: status,
    $id: id,
  });
const getExecution = (db, id) =>
  db.get('SELECT * FROM Execution WHERE id = $id', { $id: id });
const getStateMachineDefinitionForExecution = (db, id) =>
  db
    .get(
      'SELECT smv.definition FROM Execution AS e JOIN StateMachineVersion AS smv ON e.version = smv.id WHERE e.id = $executionId',
      { $executionId: id },
    )
    .then((result) => JSON.parse(result.definition));
const getDetailsForExecution = (db, id) =>
  db
    .all(
      'SELECT e.status AS executionStatus, o.* FROM Execution AS e JOIN Operation AS o ON e.id = o.execution WHERE e.id = $executionId',
      { $executionId: id },
    )
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
  return db.run(
    'INSERT INTO Operation VALUES ($id, $executionId, $created, $stateKey, $status, $input, $inputType, $output, $outputType, NULL)',
    {
      $id: id,
      $executionId: executionId,
      $created: new Date().toISOString(),
      $stateKey: stateKey,
      $status: enums.OP_STATUS.Pending,
      $input: inputMap.data,
      $inputType: inputMap.type,
      $output: null,
      $outputType: null,
    },
  );
};
const updateOperation = (db, id, status, output) => {
  const outputMap = mapTypeForStorage(output);
  return db.run(
    'UPDATE Operation SET status = $status, output = $output, outputType = $outputType WHERE id = $id',
    {
      $status: status,
      $output: outputMap.data,
      $outputType: outputMap.type,
      $id: id,
    },
  );
};
const delayOperation = (db, id, waitUntilUtc) =>
  db.run(
    'UPDATE Operation SET status = $status, waitUntilUtc = $waitUntilUtc WHERE id = $id',
    {
      $status: enums.OP_STATUS.Waiting,
      $waitUntilUtc: waitUntilUtc,
      $id: id,
    },
  );
const getOperation = (db, id) =>
  db
    .get('SELECT * FROM Operation WHERE id = $id', { $id: id })
    .then((result) => {
      const inputMap = mapTypeForReturn(result.inputType, result.input);
      const outputMap = mapTypeForReturn(result.outputType, result.output);
      const { execution, created, stateKey, status, waitUntilUtc } = result;
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
const getDelayedOperations = (db, waitUntilUtc) =>
  db.all(
    'SELECT * FROM Operation WHERE status = $status AND waitUntilUtc < $waitUntilUtc',
    {
      $status: enums.OP_STATUS.Waiting,
      $waitUntilUtc: waitUntilUtc,
    },
  );

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
