const _ = require('lodash');
const uuid = require('uuid');
const bunyan = require('bunyan');
const bunyanLogstashHttp = require('./bunyan-logstash-http');

const self = {

  buildLogStreams: () => {
    const loggerMetadata = { fromLocal: self.getEnvVar('DEBUG') };
    const logStreams = [];

    if (!/test/.test(self.getEnvVar('NODE_ENV'))) {
      logStreams.push({
        stream: process.stdout,
      });
    }

    if (self.getEnvVar('MDS_LOG_URL')) {
      logStreams.push(
        {
          stream: bunyanLogstashHttp.createLoggerStream({
            loggingEndpoint: self.getEnvVar('MDS_LOG_URL'),
            level: 'debug',
            metadata: loggerMetadata,
          }),
        },
      );
    }

    return logStreams;
  },

  /**
   * Gets a configured logger for the system.
   * @returns {bunyan} the current logger for the application
   */
  getLogger: () => {
    if (!self._logger) {
      self._logger = bunyan.createLogger({
        name: 'yeoman test dir',
        level: bunyan.TRACE,
        serializers: bunyan.stdSerializers,
        streams: self.buildLogStreams(),
      });
    }
    return self._logger;
  },

  /**
   * Resolves a promise after the specified time.
   * @param {number} timeout The amount of milliseconds to delay execution for
   * @returns {Promise<void>} A promise that resolves after the specified time.
   */
  delay: (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),

  /**
   * Generates a new GUID/UUID in the format of aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
   * @return {string} The new GUID/UUID string
   */
  newUuid: () => uuid.v4(),

  /**
   * Provides a wrapper around process.env for testing
   * @param {string} key the environment variable key
   * @param {string} defaultValue the value to return when the key does not contain a value
   * @return {string} the environment variable value
   */
  getEnvVar: (key, defaultValue) => _.get(process.env, [key], defaultValue),
};

module.exports = self;
