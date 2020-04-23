const _ = require('lodash');
const util = require('util');
const url = require('url');
const http = require('http');
const https = require('https');

const nameFromLevel = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

/**
 * Constructs a new logger object that emits events to Logstash via HTTP or HTTPS
 *
 * @param {Object} [options] An object to override settings of the logger.
 * @param {String} [options.loggingEndpoint] The HTTP/HTTPS logstash host url.
 * @param {Object} [options.metadata] The base set of metadata to send with every log message.
 * @param {Function} [error] Callback for when writing an error out occurs.
 */
function BunyanLogstashHttp(options, error) {
  const defaults = {
    loggingEndpoint: 'http://127.0.0.1:5002',
  };
  const settings = _.merge({}, defaults, options);

  this.customFormatter = options.customFormatter;
  this.error = error || function err() {};

  this._settings = settings;
  this._parsedUrl = url.parse(this._settings.loggingEndpoint);
}

BunyanLogstashHttp.prototype._postMessage = function _postMessage(message) {
  const data = JSON.stringify(message);
  const options = {
    hostname: this._parsedUrl.hostname,
    port: this._parsedUrl.port,
    path: this._parsedUrl.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
    },
  };

  const request = this._parsedUrl.protocol === 'https:' ? https.request : http.request;

  return new Promise((resolve) => {
    const req = request(options, (res) => {
      const resp = {
        statusCode: res.statusCode,
      };
      res.socket.destroy();
      resolve(resp);
    });
    req.on('error', (err) => {
      const msg = util.inspect(err, false, null, true);
      process.stderr.write(`${msg}\n`);
    });
    req.write(data);
    req.end();
  })
    .then((resp) => {
      const resolve = resp.statusCode < 400;
      return resolve ? Promise.resolve() : Promise.reject();
    });
};

BunyanLogstashHttp.prototype._log = function _log(level, message, metadata) {
  let meta;
  if (this._settings.metadata || metadata) {
    meta = _.merge({}, this._settings.metadata, metadata);
  }
  const timestamp = metadata.time;
  this._postMessage({
    '@timestamp': timestamp,
    logLevel: level,
    message,
    ...meta,
  });
};

BunyanLogstashHttp.prototype.write = function write(record) {
  const self = this;
  let rec = record;
  let message;

  if (typeof rec === 'string') {
    rec = JSON.parse(rec);
  }

  const levelName = nameFromLevel[rec.level];

  try {
    message = self.customFormatter
      ? self.customFormatter(rec, levelName)
      : { msg: rec.msg };
  } catch (err) {
    return self.error(err);
  }

  const meta = _.merge({}, rec, message);
  delete meta.msg;
  return self._log(levelName, message.msg, meta);
};

module.exports = BunyanLogstashHttp;
