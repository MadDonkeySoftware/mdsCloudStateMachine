/* eslint-disable no-unused-expressions */
const chai = require('chai');
const sinon = require('sinon');
const repos = require('../repos');

const internal = require('./internal');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('handleAppShutdown', () => {
    it('Sets inernal signal to no longer consume messages', () => {
      // Arrange
      internal._running = true;

      // Act
      internal.handleAppShutdown();

      // Assert
      chai.expect(internal._running).to.equal(false);
    });
  });

  describe('_handleOpCompleted', () => {
    it('With run data and next operation queues next op and updates current op', async () => {
      // Arrange
      const testRunData = { // TODO: Figure out if these are accurate
        output: 'test output',
        nextOpId: 'nextOpId',
        next: 'nextOpName',
      };
      internal._inFlightQueue = {
        enqueue: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._inFlightQueue.enqueue.callCount).to.equal(1);
      chai.expect(repos.updateOperation.callCount).to.equal(1);
    });

    it('With run data but without next queues updates current op', async () => {
      // Arrange
      const testRunData = { // TODO: Figure out if these are accurate
        output: 'test output',
      };
      internal._inFlightQueue = {
        enqueue: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._inFlightQueue.enqueue.callCount).to.equal(0);
      chai.expect(repos.updateOperation.callCount).to.equal(1);
    });

    it('Without run data does nothing', async () => {
      // Arrange
      const testRunData = undefined;
      internal._inFlightQueue = {
        enqueue: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._inFlightQueue.enqueue.callCount).to.equal(0);
      chai.expect(repos.updateOperation.callCount).to.equal(0);
    });
  });
});
