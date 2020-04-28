const globals = require('../../globals');
const InMemoryQueue = require('./in_memory');
const MdsQueue = require('./mds_queue');

const loadQueue = () => {
  const logger = globals.getLogger();
  if (!process.env.FN_SM_Q_URL || process.env.FN_SM_Q_URL.startsWith(':memory:')) {
    logger.debug('Using in-memory queue');
    return InMemoryQueue;
  }

  if (process.env.FN_SM_Q_URL.startsWith('mdsq://') || process.env.FN_SM_Q_URL.startsWith('mdsqs://')) {
    logger.debug({ url: process.env.FN_SM_Q_URL }, 'Using MDS Queue');
    return MdsQueue;
  }

  throw new Error(`Queue not configured properly. "${process.env.FN_SM_Q_URL}" not understood.`);
};

module.exports = loadQueue();
