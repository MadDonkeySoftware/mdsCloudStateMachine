const globals = require('../../globals');
const MdsQueue = require('./mds_queue');

const loadQueue = () => {
  const logger = globals.getLogger();
  logger.debug({ url: process.env.MDS_SM_QS_URL }, 'Using MDS Queue');
  return MdsQueue;
};

module.exports = loadQueue();
