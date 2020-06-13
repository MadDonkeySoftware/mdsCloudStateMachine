const express = require('express');

const repos = require('../repos');
const workers = require('../workers');
const globals = require('../globals');

const router = express.Router();

const listStateMachines = (request, response) => repos.getStateMachines().then((result) => {
  response.send(JSON.stringify(result));
});

const createStateMachine = (request, response) => {
  const machineId = globals.newUuid();
  return repos.createStateMachine(machineId, request.body.Name, request.body).then(() => {
    response.send(JSON.stringify({
      uuid: machineId,
    }));
  });
};

const updateStateMachine = (request, response) => {
  const { params, body } = request;
  const { id } = params;

  return repos.updateStateMachine(id, body).then(() => {
    response.send(JSON.stringify({
      uuid: id,
    }));
  }).catch((err) => {
    globals.logger.warn({ err }, 'Error updating state machine');
    response.status(500);
    response.send();
  });
};

const getStateMachine = (request, response) => {
  const { id } = request.params;
  return repos.getStateMachine(id).then((machine) => {
    if (machine) {
      response.send(JSON.stringify({
        id: machine.id,
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
  const { id } = params;
  const executionId = globals.newUuid();
  const operationId = globals.newUuid();

  return repos.getStateMachine(id)
    .then((machine) => repos.createExecution(executionId, machine.active_version)
      .then(() => repos.createOperation(operationId, executionId, machine.definition.StartAt, body))
      .then(() => workers.enqueueMessage({ executionId, operationId, fromInvoke: true }))
      .then(() => {
        response.send(JSON.stringify({
          id: executionId,
        }));
      }));
};

const getDetailsForExecution = (request, response) => {
  const { id } = request.params;
  return repos.getDetailsForExecution(id).then((details) => {
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
router.get('/execution/:id', getDetailsForExecution);

module.exports = router;
