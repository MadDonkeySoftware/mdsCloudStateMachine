const got = require('got');

/**
 * Queue implementation backed by the MDS simple queue service
 *
 * @param {string} name The name of the queue.
 */
function MdsQueue(name) {
  this.name = name;
  this.queueHost = process.env.FN_SM_Q_URL.replace('mdsqs://', 'https://').replace('mdsq://', 'http://');
  if (!this.queueHost.endsWith('/')) {
    this.queueHost += '/';
  }
}

/**
 * Enqueue a new message to be consumed later or elsewhere.
 */
MdsQueue.prototype.enqueue = function enqueue(message) {
  const url = `${this.queueHost}queue/${this.name}/message`;
  const options = {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
  };
  return got.post(url, options);
};

/**
 * Gets an available message to be processed.
 */
MdsQueue.prototype.dequeue = function dequeue() {
  const url = `${this.queueHost}queue/${this.name}/message`;
  const options = {
    headers: {
      'content-type': 'application/json',
    },
  };
  return got.get(url, options).then((resp) => {
    if (resp.statusCode === 200) {
      if (resp.body !== '{}') {
        return JSON.parse(resp.body);
      }
    }

    return null;
  });
};

/**
 * Removes a message from the queue
 */
MdsQueue.prototype.delete = function remove(id) {
  const url = `${this.queueHost}queue/${this.name}/message/${id}`;
  const options = {
    headers: {
      'content-type': 'application/json',
    },
  };
  return got.delete(url, options);
};

/**
 * Gets the current length of the queue
 */
MdsQueue.prototype.size = function size() {
  const url = `${this.queueHost}queue/${this.name}/length`;
  const options = {
    headers: {
      'content-type': 'application/json',
    },
  };
  return got.get(url, options).then((resp) => resp.size);
};

module.exports = MdsQueue;
