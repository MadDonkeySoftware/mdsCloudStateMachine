const express = require('express');

const globals = require('./globals');
const handlers = require('./handlers');

const buildApp = () => {
  const logger = globals.getLogger();
  const app = express();

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
      res.send('{"msg":"Hello World!"}');
    });

    expressApp.use('/v1/', handlers);
  };

  app.use(requestLogger);
  app.use(commonResponseSetup);
  app.use(express.json());
  app.use(express.text());
  configureRoutes(app);

  return app;
};

module.exports = {
  buildApp,
};
