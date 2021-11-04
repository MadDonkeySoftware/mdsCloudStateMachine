/* eslint-disable no-unused-expressions */
const chai = require('chai');
const sinon = require('sinon');
const repos = require('../repos');

const internal = require('./internal');
const operations = require('../operations');

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
      internal._queueClient = {
        enqueueMessage: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._queueClient.enqueueMessage.callCount).to.equal(1);
      chai.expect(repos.updateOperation.callCount).to.equal(1);
    });

    it('With run data but without next queues updates current op', async () => {
      // Arrange
      const testRunData = { // TODO: Figure out if these are accurate
        output: 'test output',
      };
      internal._queueClient = {
        enqueueMessage: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._queueClient.enqueueMessage.callCount).to.equal(0);
      chai.expect(repos.updateOperation.callCount).to.equal(1);
    });

    it('Without run data does nothing', async () => {
      // Arrange
      const testRunData = undefined;
      internal._queueClient = {
        enqueueMessage: sinon.stub().resolves(),
      };
      sinon.stub(repos, 'updateOperation').resolves();

      // Act
      await internal._handleOpCompleted('testOp', 'testExec', testRunData);

      // Assert
      chai.expect(internal._queueClient.enqueueMessage.callCount).to.equal(0);
      chai.expect(repos.updateOperation.callCount).to.equal(0);
    });
  });

  describe('_buildOperationDataBundle', () => {
    it('fetches definition from repo and returns it with the metadata', async () => {
      // Arrange
      const testMeta = {
        execution: 'testExecution',
      };
      const mockDefinition = {
        a: 'this',
        b: 'is',
        c: 'test',
        d: 'data',
      };

      sinon.stub(repos, 'getStateMachineDefinitionForExecution')
        .withArgs('testExecution').resolves(mockDefinition);

      // Act
      const data = await internal._buildOperationDataBundle(testMeta);

      // Assert
      chai.expect(data.metadata).to.deep.equal(testMeta);
      chai.expect(data.definition).to.deep.equal(mockDefinition);
    });
  });

  describe('_invokeOperation', () => {
    it('', async () => {
      // Arrange
      const testData = {
        definition: {},
        metadata: {
          id: 'testId',
          execution: 'testExecution',
        },
      };
      const stubRunData = { run: 'data' };
      const updateOpStub = sinon.stub(repos, 'updateOperation');
      const opCompletedStub = sinon.stub(internal, '_handleOpCompleted').resolves();
      sinon.stub(operations, 'getOperation').returns({
        run: sinon.stub().resolves(stubRunData),
      });

      // Act
      await internal._invokeOperation(testData);

      // Assert
      chai.expect(updateOpStub.callCount).to.equal(1);
      chai.expect(opCompletedStub.callCount).to.equal(1);
      chai.expect(updateOpStub.getCall(0).args).to.deep.equal(['testId', 'Executing']);
      chai.expect(opCompletedStub.getCall(0).args).to.deep.equal(['testId', 'testExecution', stubRunData]);
    });
  });
});
