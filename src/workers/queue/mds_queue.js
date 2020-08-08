const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');

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

  this.client = mdsSdk.getQueueServiceClient(this.queueHost);
}

/**
 * Enqueue a new message to be consumed later or elsewhere.
 */
MdsQueue.prototype.enqueue = function enqueue(message) {
  return this.client.enqueueMessage(this.name, message);
};

/**
 * Gets an available message to be processed.
 */
MdsQueue.prototype.dequeue = function dequeue() {
  return this.client.fetchMessage(this.name);
};

/**
 * Removes a message from the queue
 */
MdsQueue.prototype.delete = function remove(id) {
  return this.client.deleteMessage(this.name, id);
};

/**
 * Gets the current length of the queue
 */
MdsQueue.prototype.size = function size() {
  this.client.getQueueLength(this.name).then((resp) => resp.size);
};

module.exports = MdsQueue;
