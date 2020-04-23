const uuid = require('uuid');
const bunyan = require('bunyan');
const BunyanLogstashHttp = require('./bunyan-logstash-http');

/**
 * returns the current logger for the application
 */
const loggerMetadata = { fromLocal: process.env.DEBUG };
const logStreams = [
  {
    stream: process.stdout,
  },
];
if (process.env.MDS_LOG_URL) {
  logStreams.push(
    {
      stream: new BunyanLogstashHttp({
        loggingEndpoint: process.env.MDS_LOG_URL,
        level: 'debug',
        metadata: loggerMetadata,
      }),
    },
  );
}
const activeLogger = bunyan.createLogger({
  name: 'mdsCloudStateMachine',
  level: bunyan.TRACE,
  serializers: bunyan.stdSerializers,
  streams: logStreams,
});

/**
 * Promise wrapper around process.nextTick
 */
const nextTick = () => new Promise((resolve) => process.nextTick(resolve));

const delay = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout));

const newUuid = () => uuid.v4();

module.exports = {
  logger: activeLogger,
  nextTick,
  delay,
  newUuid,
};
