const chai = require('chai');
const sinon = require('sinon');

const enums = require('../enums');
const repos = require('../repos');
const Fail = require('./fail');

describe(__filename, () => {
  const definition = {
    Type: 'Fail',
  };

  beforeEach(() => {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe('fail', () => {
    it('Should throw exception when definition Type is not Fail', () => {
      // Arrange
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };

      // Act
      try {
        Fail.call({}, { Type: 'Task' }, metadata);
      } catch (err) {
        chai
          .expect(err.message)
          .to.be.equal('Attempted to use Task type for "Fail".');
      }
    });

    describe('Should succeed operation and fail execution', () => {
      it('when input is undefined', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
        };
        const op = new Fail(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();

        // Act
        return op.run().then(() => {
          // Assert
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(1);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql([
              'operationId',
              'executionId',
              enums.OP_STATUS.Succeeded,
              undefined,
            ]);
          chai
            .expect(updateExecutionStub.getCall(0).args)
            .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        });
      });

      it('when input is null', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: null,
        };
        const op = new Fail(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();

        // Act
        return op.run().then(() => {
          // Assert
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(1);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql([
              'operationId',
              'executionId',
              enums.OP_STATUS.Succeeded,
              null,
            ]);
          chai
            .expect(updateExecutionStub.getCall(0).args)
            .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        });
      });

      it('when input is a string', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: 'abc',
        };
        const op = new Fail(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();

        // Act
        return op.run().then(() => {
          // Assert
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(1);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql([
              'operationId',
              'executionId',
              enums.OP_STATUS.Succeeded,
              'abc',
            ]);
          chai
            .expect(updateExecutionStub.getCall(0).args)
            .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        });
      });

      it('when input is a object', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { a: 1, b: 2 },
        };
        const op = new Fail(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();

        // Act
        return op.run().then(() => {
          // Assert
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(1);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql([
              'operationId',
              'executionId',
              enums.OP_STATUS.Succeeded,
              metadata.input,
            ]);
          chai
            .expect(updateExecutionStub.getCall(0).args)
            .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        });
      });
    });
  });
});
