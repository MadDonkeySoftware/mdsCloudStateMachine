const express = require('express');
const orid = require('@maddonkeysoftware/orid-node');
const _ = require('lodash');

const repos = require('../repos');
const workers = require('../workers');
const globals = require('../globals');

const router = express.Router();

const oridBase = {
  provider: process.env.MDS_FN_PROVIDER_KEY,
  custom3: 1, // TODO: Implement account
  service: 'sm',
};

const listStateMachines = (request, response) => repos.getStateMachines().then((result) => {
  const data = _.map(result, (sm) => _.merge(
    {},
    sm,
    { orid: orid.v1.generate(_.merge({}, oridBase, { resourceId: sm.id })) },
  ));

  response.send(JSON.stringify(data));
});

const createStateMachine = (request, response) => {
  const machineId = globals.newUuid();
  return repos.createStateMachine(machineId, request.body.Name, request.body).then(() => {
    response.send(JSON.stringify({
      orid: orid.v1.generate(_.merge({}, oridBase, { resourceId: machineId })),
    }));
  });
};

const updateStateMachine = (request, response) => {
  const { params, body } = request;

  const inputOrid = orid.v1.isValid(params.id) ? orid.v1.parse(params.id) : undefined;
  const resourceId = inputOrid ? inputOrid.resourceId : params.id;

  return repos.updateStateMachine(resourceId, body).then(() => {
    response.send(JSON.stringify({
      uuid: resourceId,
    }));
  }).catch((err) => {
    globals.logger.warn({ err }, 'Error updating state machine');
    response.status(500);
    response.send();
  });
};

const getStateMachine = (request, response) => {
  const { params } = request;
  const inputOrid = orid.v1.isValid(params.id) ? orid.v1.parse(params.id) : undefined;
  const machineId = inputOrid ? inputOrid.resourceId : params.id;

  return repos.getStateMachine(machineId).then((machine) => {
    if (machine) {
      response.send(JSON.stringify({
        id: machine.id,
        orid: orid.v1.generate(_.merge({}, oridBase, { resourceId: machine.id })),
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

  const inputOrid = orid.v1.isValid(params.id) ? orid.v1.parse(params.id) : undefined;
  const machineId = inputOrid ? inputOrid.resourceId : params.id;

  return repos.getStateMachine(machineId)
    .then((machine) => repos.createExecution(executionId, machine.active_version)
      .then(() => repos.createOperation(operationId, executionId, machine.definition.StartAt, body))
      .then(() => workers.enqueueMessage({ executionId, operationId, fromInvoke: true }))
      .then(() => {
        response.send(JSON.stringify({
          id: executionId,
          orid: orid.v1.generate(_.merge(
            {},
            oridBase,
            { useSlashSeparator: true, resourceType: machineId, resourceId: executionId },
          )),
        }));
      }));
};

const getDetailsForExecution = (request, response) => {
  const { params } = request;

  const id = params.id + params[0];
  const inputOrid = orid.v1.isValid(id) ? orid.v1.parse(id) : undefined;
  const executionId = inputOrid && inputOrid.resourceId ? inputOrid.resourceId : params.id;

  return repos.getDetailsForExecution(executionId).then((details) => {
    if (details) {
      response.send(JSON.stringify({
        ...details,
      }));
    } else {
      response.status(404);
      response.send();
    }
  });
};

router.get('/machines', listStateMachines);
router.post('/machine', createStateMachine);
router.post('/machine/:id', updateStateMachine);
router.get('/machine/:id', getStateMachine);
router.post('/machine/:id/invoke', invokeStateMachine);
router.get('/execution/:id*', getDetailsForExecution);

module.exports = router;
