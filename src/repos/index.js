// All interactions with any storage mechanism should go through a "top level"
// repository such as this module. Implementation details should be hidden from
// callers to make supporting different stores as easy as possible.
const sqliteDb = require('./sqlite3');
const mysqlDb = require('./mysql');

const initializeSqliteDb = () => {
  const getDb = () => sqliteDb.getDb();

  const handleAppShutdown = () => getDb().then((db) => db.close());

  const getStateMachines = (accountId) => getDb()
    .then((db) => sqliteDb.getStateMachines(db, accountId));
  const createStateMachine = (id, accountId, name, definition) => getDb()
    .then((db) => sqliteDb.createStateMachine(db, id, accountId, name, definition));
  const getStateMachine = (id) => getDb().then((db) => sqliteDb.getStateMachine(db, id));
  const updateStateMachine = (id, definition) => getDb()
    .then((db) => sqliteDb.updateStateMachine(db, id, definition));
  const removeStateMachine = () => getDb().then(() => undefined); // HACK: Sqlite3 to be deprecated.

  const createExecution = (id, versionId) => (
    getDb().then((db) => sqliteDb.createExecution(db, id, versionId)));
  const updateExecution = (id, status) => (
    getDb().then((db) => sqliteDb.updateExecution(db, id, status)));
  const getExecution = (id) => getDb().then((db) => sqliteDb.getExecution(db, id));
  const getStateMachineDefinitionForExecution = (id) => (
    getDb().then((db) => sqliteDb.getStateMachineDefinitionForExecution(db, id)));
  const getDetailsForExecution = (id) => (
    getDb().then((db) => sqliteDb.getDetailsForExecution(db, id)));

  const createOperation = (id, executionId, stateKey, input) => (
    getDb().then((db) => sqliteDb.createOperation(db, id, executionId, stateKey, input)));
  const updateOperation = (id, state, output) => (
    getDb().then((db) => sqliteDb.updateOperation(db, id, state, output)));
  const delayOperation = (id, waitUtilUtc) => (
    getDb().then((db) => sqliteDb.delayOperation(db, id, waitUtilUtc)));
  const getOperation = (id) => getDb().then((db) => sqliteDb.getOperation(db, id));
  const getDelayedOperations = (waitUtilUtc) => (
    getDb().then((db) => sqliteDb.getDelayedOperations(db, waitUtilUtc)));

  return {
    handleAppShutdown,
    getStateMachines,
    createStateMachine,
    getStateMachine,
    updateStateMachine,
    removeStateMachine,
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
};

const initializeMysqlDb = () => {
  const getDb = () => mysqlDb.getDb();

  const handleAppShutdown = () => getDb().then((db) => db.close());

  const getStateMachines = (accountId) => getDb()
    .then((db) => mysqlDb.getStateMachines(db, accountId));
  const createStateMachine = (id, accountId, name, definition) => getDb()
    .then((db) => mysqlDb.createStateMachine(db, id, accountId, name, definition));
  const getStateMachine = (id) => getDb().then((db) => mysqlDb.getStateMachine(db, id));
  const updateStateMachine = (id, definition) => getDb()
    .then((db) => mysqlDb.updateStateMachine(db, id, definition));
  const removeStateMachine = (id) => getDb()
    .then((db) => mysqlDb.removeStateMachine(db, id));

  const createExecution = (id, versionId) => (
    getDb().then((db) => mysqlDb.createExecution(db, id, versionId)));
  const updateExecution = (id, status) => (
    getDb().then((db) => mysqlDb.updateExecution(db, id, status)));
  const getExecution = (id) => getDb().then((db) => mysqlDb.getExecution(db, id));
  const getStateMachineDefinitionForExecution = (id) => (
    getDb().then((db) => mysqlDb.getStateMachineDefinitionForExecution(db, id)));
  const getDetailsForExecution = (id) => (
    getDb().then((db) => mysqlDb.getDetailsForExecution(db, id)));

  const createOperation = (id, executionId, stateKey, input) => (
    getDb().then((db) => mysqlDb.createOperation(db, id, executionId, stateKey, input)));
  const updateOperation = (id, state, output) => (
    getDb().then((db) => mysqlDb.updateOperation(db, id, state, output)));
  const delayOperation = (id, waitUtilUtc) => (
    getDb().then((db) => mysqlDb.delayOperation(db, id, waitUtilUtc)));
  const getOperation = (id) => getDb().then((db) => mysqlDb.getOperation(db, id));
  const getDelayedOperations = (waitUtilUtc) => (
    getDb().then((db) => mysqlDb.getDelayedOperations(db, waitUtilUtc)));

  return {
    handleAppShutdown,
    getStateMachines,
    createStateMachine,
    getStateMachine,
    updateStateMachine,
    removeStateMachine,
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
};

const initializeDatabase = () => {
  // TODO: Depricate sqlite and mysql
  // TODO: Implement mongodb
  if (!process.env.FN_SM_DB_URL || process.env.FN_SM_DB_URL.startsWith('sqlite3://')) {
    return initializeSqliteDb();
  }

  if (process.env.FN_SM_DB_URL.startsWith('mysql://')) {
    return initializeMysqlDb();
  }
  throw new Error(`Database not configured properly. "${process.env.FN_SM_DB_URL}" not understood.`);
};

module.exports = initializeDatabase();
