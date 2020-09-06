const express = require('express');
const orid = require('@maddonkeysoftware/orid-node');
const _ = require('lodash');

const repos = require('../repos');
const workers = require('../workers');
const globals = require('../globals');

const router = express.Router();

const oridBase = {
  provider: process.env.MDS_SM_PROVIDER_KEY,
  custom3: 1, // TODO: Implement account
  service: 'sm',
};

const makeOrid = (resourceId) => orid.v1.generate(_.merge({}, oridBase, { resourceId }));

const listStateMachines = (request, response) => repos.getStateMachines().then((result) => {
  const data = _.map(result, (sm) => _.merge(
    {},
    sm,
    { orid: makeOrid(sm.id) },
  ));

  response.send(JSON.stringify(data));
});

const createStateMachine = (request, response) => {
  const machineId = globals.newUuid();
  return repos.createStateMachine(machineId, request.body.Name, request.body).then(() => {
    response.send(JSON.stringify({
      orid: makeOrid(machineId),
    }));
  });
};

const updateStateMachine = (request, response) => {
  const { params, body } = request;

  const inputOrid = orid.v1.parse(params.id);
  const { resourceId } = inputOrid;

  return repos.updateStateMachine(resourceId, body).then(() => {
    response.send(JSON.stringify({
      orid: makeOrid(resourceId),
    }));
  }).catch((err) => {
    globals.logger.warn({ err }, 'Error updating state machine');
    response.status(500);
    response.send();
  });
};

const getStateMachine = (request, response) => {
  const { params } = request;
  // const inputOrid = orid.v1.isValid(params.id) ? orid.v1.parse(params.id) : undefined;
  // const machineId = inputOrid ? inputOrid.resourceId : params.id;
  const inputOrid = orid.v1.parse(params.id);
  const { resourceId } = inputOrid;

  return repos.getStateMachine(resourceId).then((machine) => {
    if (machine) {
      response.send(JSON.stringify({
        id: machine.id,
        orid: makeOrid(machine.id),
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
  const { params, body } = request;
  const executionId = globals.newUuid();
  const operationId = globals.newUuid();

  const inputOrid = orid.v1.parse(params.id);
  const { resourceId } = inputOrid;

  return repos.getStateMachine(resourceId)
    .then((machine) => repos.createExecution(executionId, machine.active_version)
      .then(() => repos.createOperation(operationId, executionId, machine.definition.StartAt, body))
      .then(() => workers.enqueueMessage({ executionId, operationId, fromInvoke: true }))
      .then(() => {
        response.send(JSON.stringify({
          id: executionId,
          orid: orid.v1.generate(_.merge(
            {},
            oridBase,
            { useSlashSeparator: true, resourceId, resourceRider: executionId },
          )),
        }));
      }));
};

const getDetailsForExecution = (request, response) => {
  const { params } = request;

  const inputOrid = orid.v1.parse(params.id + params[0]);
  const { resourceRider } = inputOrid;

  if (!resourceRider) {
    response.status(400);
    response.send();
    return undefined;
  }

  return repos.getDetailsForExecution(resourceRider).then((details) => {
    if (details) {
      response.send(JSON.stringify({
        orid: params.id + params[0],
        status: details.status,
        operations: details.operations,
      }));
    } else {
      response.status(404);
      response.send();
    }
  });
};

const ensureValidOrid = (request, response, next) => {
  const { params } = request;
  const id = params[0] ? params.id + params[0] : params.id;

  if (!orid.v1.isValid(id)) {
    response.status(400);
    response.send();
    return undefined;
  }

  return next();
};

router.get('/machines', listStateMachines);
router.post('/machine', createStateMachine);
router.post('/machine/:id', ensureValidOrid, updateStateMachine);
router.get('/machine/:id', ensureValidOrid, getStateMachine);
router.post('/machine/:id/invoke', ensureValidOrid, invokeStateMachine);
router.get('/execution/:id*', ensureValidOrid, getDetailsForExecution);

module.exports = router;
