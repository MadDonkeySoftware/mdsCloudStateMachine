const bodyParser = require('body-parser');
const express = require('express');
const { logger } = require('./globals');
const handlers = require('./handlers');
const appShutdown = require('./handlers/app_shutdown');

const app = express();
const port = 8888;

const requestLogger = (req, res, next) => {
  logger.trace({ path: req.path, method: req.method }, 'Handling request');
  next();
};

const commonResponseSetup = (req, res, next) => {
  res.setHeader('content-type', 'application/json');
  next();
};

const configureRoutes = (expressApp) => {
  expressApp.get('/', (req, res) => {
    // TODO: Need to create help documentation and publish it here.
    res.send('Hello World!');
  });

  expressApp.get('/machines', handlers.listStateMachines);

  expressApp.post('/machine', handlers.createStateMachine);
  expressApp.post('/machine/:id', handlers.updateStateMachine);
  expressApp.get('/machine/:id', handlers.getStateMachine);
  expressApp.post('/machine/:id/invoke', handlers.invokeStateMachine);

  expressApp.get('/execution/:id', handlers.getDetailsForExecution);
};

appShutdown.wire();
app.use(requestLogger);
app.use(commonResponseSetup);
app.use(bodyParser.json());
configureRoutes(app);

app.listen(port, () => logger.info({ port }, `Example app listening on port ${port}!`));
