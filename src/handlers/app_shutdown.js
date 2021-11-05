const globals = require('../globals');
const repos = require('../repos');

const logger = globals.getLogger();

const exitHandler = async (options, exitCode) => {
  if (options.cleanup) logger.trace('cleanup');
  if (options.exitCode || exitCode === 0) logger.trace({ exitCode }, `ExitCode: ${exitCode}`);
  if (options.exit) {
    logger.info('Shutting down.');
    await repos.handleAppShutdown();
    if (options.onShutdown) {
      const ret = options.onShutdown();
      if (ret && ret.then) return ret;
    }
    // TODO: Should this be here?
    process.exit();
  }
  return undefined;
};

const wire = (onShutdown) => {
  // do something when app is closing
  process.on('exit', exitHandler.bind(null, { cleanup: true }));

  // catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, { exit: true, onShutdown }));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, { exit: true, onShutdown }));
  process.on('SIGUSR2', exitHandler.bind(null, { exit: true, onShutdown }));

  // catches uncaught exceptions
  process.on('uncaughtException', (ex) => {
    logger.error({ err: ex }, 'Unhandled Exception');
  });
};

module.exports = {
  wire,
};
