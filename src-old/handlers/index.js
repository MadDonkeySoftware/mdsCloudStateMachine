const express = require('express');
const orid = require('@maddonkeysoftware/orid-node');
const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');
const _ = require('lodash');

const repos = require('../repos');
// const workers = require('../workers');
const globals = require('../globals');
const handlerHelpers = require('./handler-helpers');

const router = express.Router();
const logger = globals.getLogger();

const makeOrid = (resourceId, accountId, rider) => {
  const oridBase = {
    provider: handlerHelpers.getIssuer(),
    service: 'sm',
  };
  return orid.v1.generate(
    _.merge({}, oridBase, {
      resourceId,
      custom3: accountId,
      resourceRider: rider,
      useSlashSeparator: true,
    }),
  );
};

const listStateMachines = (request, response) => {
  const { accountId } = request.parsedToken.payload;
  return repos.getStateMachines(accountId).then((result) => {
    const data = _.map(result, (sm) =>
      _.merge({}, sm, { orid: makeOrid(sm.id, accountId) }),
    );

    handlerHelpers.sendResponse(response, 200, JSON.stringify(data));
  });
};

const createStateMachine = (request, response) => {
  const { accountId } = request.parsedToken.payload;
  const machineId = globals.newUuid();
  return repos
    .createStateMachine(machineId, accountId, request.body.Name, request.body)
    .then(() => {
      response.send(
        JSON.stringify({
          orid: makeOrid(machineId, accountId),
        }),
      );
    });
};

const updateStateMachine = (request, response) => {
  const { body } = request;

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  return repos
    .updateStateMachine(resourceId, body)
    .then(() => {
      response.send(
        JSON.stringify({
          orid: makeOrid(resourceId, accountId),
        }),
      );
    })
    .catch((err) => {
      logger.warn({ err }, 'Error updating state machine');
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
      return repos
        .removeStateMachine(resourceId)
        .then(() => {
          response.send(
            JSON.stringify({
              orid: makeOrid(resourceId, accountId),
            }),
          );
        })
        .catch((err) => {
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
      response.send(
        JSON.stringify({
          orid: makeOrid(machine.id, accountId),
          name: machine.name,
          definition: machine.definition,
        }),
      );
    } else {
      response.status(404);
      response.send();
    }
  });
};

const invokeStateMachine = async (request, response) => {
  const { body } = request;
  const executionId = globals.newUuid();
  const operationId = globals.newUuid();

  const requestOrid = handlerHelpers.getOridFromRequest(request, 'orid');
  const { resourceId } = requestOrid;
  const accountId = requestOrid.custom3;

  const queueClient = await mdsSdk.getQueueServiceClient();
  const machine = await repos.getStateMachine(resourceId);
  if (machine) {
    await repos.createExecution(executionId, machine.id, machine.activeVersion);
    await repos.createOperation(
      operationId,
      executionId,
      machine.definition.StartAt,
      body,
    );
    await queueClient.enqueueMessage(globals.getEnvVar('PENDING_QUEUE_NAME'), {
      executionId,
      operationId,
      fromInvoke: true,
    });
    return handlerHelpers.sendResponse(
      response,
      200,
      JSON.stringify({
        orid: makeOrid(resourceId, accountId, executionId),
      }),
    );
  }

  return handlerHelpers.sendResponse(response, 404);
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
      response.send(
        JSON.stringify({
          orid: makeOrid(resourceId, accountId, resourceRider),
          status: details.status,
          operations: details.operations,
        }),
      );
    } else {
      response.status(404);
      response.send();
    }
  });
};

router.get(
  '/machines',
  handlerHelpers.validateToken(logger),
  listStateMachines,
);
router.post(
  '/machine',
  handlerHelpers.validateToken(logger),
  createStateMachine,
);
router.post(
  '/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  updateStateMachine,
);
router.delete(
  '/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  removeStateMachine,
);
router.get(
  '/machine/:orid',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  getStateMachine,
);
router.post(
  '/machine/:orid/invoke',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(false, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  invokeStateMachine,
);
router.get(
  '/execution/:orid*',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestOrid(true, 'orid'),
  handlerHelpers.canAccessResource({ oridKey: 'orid', logger }),
  getDetailsForExecution,
);

module.exports = router;
