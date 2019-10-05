const { logger } = require('../globals');
const internal = require('./internal');

const initializeQueue = (fromHttpApp) => {
  if (!process.env.FN_SM_Q_URL || process.env.FORCE_INTERNAL_WORKER) {
    logger.warn('Using internal message queue worker. This is not intended for production use.');
    logger.info('Staring in-process queue worker.');
    internal.startWorker();

    return {
      handleAppShutdown: internal.handleAppShutdown,
      enqueueMessage: internal.enqueueMessage,
    };
  }

  const msg = `Queue not configured properly. "${process.env.FN_SM_Q_URL}" not understood.`;
  throw new Error(msg);
};

module.exports = initializeQueue(require.main !== module);
