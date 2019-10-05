const uuid = require('uuid');

/**
 * In memory queue implementation. Not for production use!
 *
 * @param {string} name The name of the queue.
 */
function InMemoryQueue(name) {
  this.data = [];
  this.name = name;
}

/**
 * Enqueue a new message to be consumed later or elsewhere.
 */
InMemoryQueue.prototype.enqueue = function enqueue(item) {
  const message = {
    id: uuid.v4().replace('-', ''),
    message: JSON.stringify(item),
  };
  return Promise.resolve(this.data.unshift(message));
};

/**
 * Gets an available message to be processed.
 */
InMemoryQueue.prototype.dequeue = function dequeue() {
  return Promise.resolve(this.data.length > 0 ? this.data[this.data.length - 1] : null);
};

/**
 * Removes a message from the queue
 */
InMemoryQueue.prototype.delete = function remove() {
  return Promise.resolve(this.data.pop());
};

/**
 * Gets the current length of the queue
 */
InMemoryQueue.prototype.size = function size() {
  return Promise.resolve(this.data.length);
};

module.exports = InMemoryQueue;
