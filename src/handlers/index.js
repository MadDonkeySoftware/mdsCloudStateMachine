const express = require('express');
const orid = require('@maddonkeysoftware/orid-node');
const _ = require('lodash');

const repos = require('../repos');
const workers = require('../workers');
const globals = require('../globals');
const handlerHelpers = require('./handler-helpers');

const router = express.Router();
const logger = globals.getLogger();

const oridBase = {
  provider: handlerHelpers.getIssuer(),
  service: 'sm',
};

const makeOrid = (resourceId, accountId, rider) => orid.v1.generate(_.merge({}, oridBase, {
  resourceId,
  custom3: accountId,
  resourceRider: rider,
  useSlashSeparator: true,
}));

const listStateMachines = (request, response) => {
  const { accountId } = request.parsedToken.payload;
  return repos.getStateMachines(accountId).then((result) => {
    const data = _.map(result, (sm) => _.merge(
      {},
      sm,
      { orid: makeOrid(sm.id, accountId) },
    ));

    handlerHelpers.sendResponse(response, 200, JSON.stringify(data));
  });
};

const createStateMachine = (request, response) => {
  const { accountId } = request.parsedToken.payload;
  const machineId = globals.newUuid();
  return repos.createStateMachine(machineId, accountId, request.body.Name, request.body)
    .then(() => {
      response.send(JSON.stringify({
        orid: makeOrid(machineId, accountId),
      }));
    });
};

const updateStateMachine = (request, response) => {
  const { body } = request;

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repos.updateStateMachine(resourceId, body).then(() => {
    response.send(JSON.stringify({
      orid: makeOrid(resourceId, accountId),
    }));
  }).catch((err) => {
    globals.logger.warn({ err }, 'Error updating state machine');
    response.status(500);
    response.send();
  });
};

const removeStateMachine = (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repos.getStateMachine(resourceId).then((machine) => {
    if (machine) {
      return repos.removeStateMachine(resourceId).then(() => {
        response.send(JSON.stringify({
          orid: makeOrid(resourceId, accountId),
        }));
      }).catch((err) => {
        globals.logger.warn({ err }, 'Error updating state machine');
        response.status(500);
        response.send();
      });
    }

    response.status(404);
    response.send();
    return undefined;
  });
};

const getStateMachine = (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repos.getStateMachine(resourceId).then((machine) => {
    if (machine) {
      response.send(JSON.stringify({
        orid: makeOrid(machine.id, accountId),
        name: machine.name,
        definition: machine.definition,
      }));
    } else {
      response.status(404);
      response.send();
    }
  });
};

const invokeStateMachine = (request, response) => {
  const { body } = request;
  const executionId = globals.newUuid();
  const operationId = globals.newUuid();

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repos.getStateMachine(resourceId)
    .then((machine) => {
      if (machine) {
        return repos.createExecution(executionId, machine.active_version)
          .then(() => repos.createOperation(
            operationId,
            executionId,
            machine.definition.StartAt,
            body,
          ))
          .then(() => workers.enqueueMessage({ executionId, operationId, fromInvoke: true }))
          .then(() => {
            response.send(JSON.stringify({
              orid: makeOrid(resourceId, accountId, executionId),
            }));
          });
      }
      response.status(404);
      response.send();
      return undefined;
    });
};

const getDetailsForExecution = (request, response) => {
  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId, resourceRider } = requestOrid;
  const accountId = requestOrid.custom3;

  if (!resourceRider) {
    response.status(400);
    response.send();
    return undefined;
  }

  return repos.getDetailsForExecution(resourceRider).then((details) => {
    if (details) {
      response.send(JSON.stringify({
        orid: makeOrid(resourceId, accountId, resourceRider),
        status: details.status,
        operations: details.operations,
      }));
    } else {
      response.status(404);
      response.send();
    }
  });
};

router.get('/machines',
  handlerHelpers.validateToken(logger),
  listStateMachines);
router.post('/machine',
  handlerHelpers.validateToken(logger),
  createStateMachine);
router.post('/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  updateStateMachine);
router.delete('/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  removeStateMachine);
router.get('/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  getStateMachine);
router.post('/machine/:orid/invoke',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  invokeStateMachine);
router.get('/execution/:orid*',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(true, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  getDetailsForExecution);

module.exports = router;
