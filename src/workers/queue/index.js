const InMemoryQueue = require('./in_memory');
const MdsQueue = require('./mds_queue');

const loadQueue = () => {
  if (!process.env.FN_SM_Q_URL || process.env.FN_SM_Q_URL.startsWith(':memory:')) {
    return InMemoryQueue;
  }

  if (process.env.FN_SM_Q_URL.startsWith('mdsq://') || process.env.FN_SM_Q_URL.startsWith('mdsqs://')) {
    return MdsQueue;
  }

  throw new Error(`Queue not configured properly. "${process.env.FN_SM_Q_URL}" not understood.`);
};

module.exports = loadQueue();
