const chai = require('chai');
const chaiExclude = require('chai-exclude');
const sinon = require('sinon');

const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');
const globals = require('../globals');
const enums = require('../enums');
const repos = require('../repos');
const Task = require('./task');

chai.use(chaiExclude);

describe('operations', () => {
  const definition = {
    Type: 'Task',
    Resource: 'orid:1::::1:sf:some-id',
  };

  beforeEach(() => {
    this.sandbox = sinon.createSandbox();

    // Couldn't get this syntax to work but below did *shrug*: this.sandbox.stub(globals, 'logger');
    // globals.logger = this.sandbox.stub(globals.logger);
    this.sandbox.stub(globals, 'getLogger').returns(sinon.stub());
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe('task', () => {
    it('Should throw exception when definition Type is not Task', () => {
      // Arrange
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };

      // Act
      try {
        Task.call({}, { Type: 'Succeed' }, metadata);
      } catch (err) {
        chai
          .expect(err.message)
          .to.be.equal('Attempted to use Succeed type for "Task".');
      }
    });

    it('Should throw exception when invoke throws exception.', () => {
      // Arrange
      const sfClientStub = {
        invokeFunction: this.sandbox.stub(),
      };
      this.sandbox
        .stub(mdsSdk, 'getServerlessFunctionsClient')
        .returns(sfClientStub);
      sfClientStub.invokeFunction.rejects(new Error('not found'));

      definition.Next = { Type: 'Succeed' };
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };
      const op = new Task(definition, metadata);
      const updateOperationStub = this.sandbox
        .stub(repos, 'updateOperation')
        .resolves();
      const createOperationStub = this.sandbox
        .stub(repos, 'createOperation')
        .resolves();
      const updateExecutionStub = this.sandbox
        .stub(repos, 'updateExecution')
        .resolves();
      this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

      // Act
      return op.run().catch((err) => {
        // Assert
        chai
          .expect(sfClientStub.invokeFunction.getCalls().length)
          .to.be.equal(1);
        chai
          .expect(sfClientStub.invokeFunction.getCall(0).args)
          .to.be.eql([definition.Resource, undefined]);

        chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
        chai.expect(createOperationStub.getCalls().length).to.be.equal(0);
        chai
          .expect(updateOperationStub.getCall(0).args)
          .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
        chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
        chai
          .expect(updateExecutionStub.getCall(0).args)
          .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        chai.expect(err.message).to.be.eql('not found');
      });
    });

    describe('Should succeed operation and create next operation', () => {
      it('when input is undefined', () => {
        // Arrange
        const expectedOutput = { test: 'data' };
        const sfClientStub = {
          invokeFunction: this.sandbox.stub(),
        };
        this.sandbox
          .stub(mdsSdk, 'getServerlessFunctionsClient')
          .returns(sfClientStub);
        sfClientStub.invokeFunction.resolves(expectedOutput);
        definition.Next = { Type: 'Succeed' };
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
        };
        const op = new Task(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((thenResult) => {
          // Assert
          chai
            .expect(sfClientStub.invokeFunction.getCalls().length)
            .to.be.equal(1);
          chai
            .expect(sfClientStub.invokeFunction.getCall(0).args)
            .to.be.eql([definition.Resource, metadata.input]);
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
          chai.expect(createOperationStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
          chai
            .expect(updateOperationStub.getCall(1).args)
            .to.be.eql([
              'operationId',
              enums.OP_STATUS.Succeeded,
              JSON.stringify(expectedOutput),
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql([
              'nextOpId',
              'executionId',
              definition.Next,
              JSON.stringify(expectedOutput),
            ]);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(0);
          chai.expect(thenResult).to.be.eql({
            next: definition.Next,
            nextOpId: 'nextOpId',
            output: JSON.stringify(expectedOutput),
          });
        });
      });

      it('when input is null', () => {
        // Arrange
        const expectedOutput = { test: 'data' };
        const sfClientStub = {
          invokeFunction: this.sandbox.stub(),
        };
        this.sandbox
          .stub(mdsSdk, 'getServerlessFunctionsClient')
          .returns(sfClientStub);
        sfClientStub.invokeFunction.resolves(expectedOutput);
        definition.Next = { Type: 'Succeed' };
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: null,
        };
        const op = new Task(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((thenResult) => {
          // Assert
          chai
            .expect(sfClientStub.invokeFunction.getCalls().length)
            .to.be.equal(1);
          chai
            .expect(sfClientStub.invokeFunction.getCall(0).args)
            .to.be.eql([definition.Resource, metadata.input]);
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
          chai.expect(createOperationStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
          chai
            .expect(updateOperationStub.getCall(1).args)
            .to.be.eql([
              'operationId',
              enums.OP_STATUS.Succeeded,
              JSON.stringify(expectedOutput),
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql([
              'nextOpId',
              'executionId',
              definition.Next,
              JSON.stringify(expectedOutput),
            ]);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(0);
          chai.expect(thenResult).to.be.eql({
            next: definition.Next,
            nextOpId: 'nextOpId',
            output: JSON.stringify(expectedOutput),
          });
        });
      });

      it('when input is a string', () => {
        // Arrange
        const expectedOutput = { test: 'data' };
        const sfClientStub = {
          invokeFunction: this.sandbox.stub(),
        };
        this.sandbox
          .stub(mdsSdk, 'getServerlessFunctionsClient')
          .returns(sfClientStub);
        sfClientStub.invokeFunction.resolves(expectedOutput);
        definition.Next = { Type: 'Succeed' };
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: 'abc',
        };
        const op = new Task(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((thenResult) => {
          // Assert
          chai
            .expect(sfClientStub.invokeFunction.getCalls().length)
            .to.be.equal(1);
          chai
            .expect(sfClientStub.invokeFunction.getCall(0).args)
            .to.be.eql([definition.Resource, metadata.input]);
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
          chai.expect(createOperationStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
          chai
            .expect(updateOperationStub.getCall(1).args)
            .to.be.eql([
              'operationId',
              enums.OP_STATUS.Succeeded,
              JSON.stringify(expectedOutput),
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql([
              'nextOpId',
              'executionId',
              definition.Next,
              JSON.stringify(expectedOutput),
            ]);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(0);
          chai.expect(thenResult).to.be.eql({
            next: definition.Next,
            nextOpId: 'nextOpId',
            output: JSON.stringify(expectedOutput),
          });
        });
      });

      it('when input is a object', () => {
        // Arrange
        const expectedOutput = { test: 'data' };
        const sfClientStub = {
          invokeFunction: this.sandbox.stub(),
        };
        this.sandbox
          .stub(mdsSdk, 'getServerlessFunctionsClient')
          .returns(sfClientStub);
        sfClientStub.invokeFunction.resolves(expectedOutput);
        definition.Next = { Type: 'Succeed' };
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testInput: 1234 },
        };
        const op = new Task(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        const updateExecutionStub = this.sandbox
          .stub(repos, 'updateExecution')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((thenResult) => {
          // Assert
          chai
            .expect(sfClientStub.invokeFunction.getCalls().length)
            .to.be.equal(1);
          chai
            .expect(sfClientStub.invokeFunction.getCall(0).args)
            .to.be.eql([definition.Resource, JSON.stringify(metadata.input)]);
          chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
          chai.expect(createOperationStub.getCalls().length).to.be.equal(1);
          chai
            .expect(updateOperationStub.getCall(0).args)
            .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
          chai
            .expect(updateOperationStub.getCall(1).args)
            .to.be.eql([
              'operationId',
              enums.OP_STATUS.Succeeded,
              JSON.stringify(expectedOutput),
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql([
              'nextOpId',
              'executionId',
              definition.Next,
              JSON.stringify(expectedOutput),
            ]);
          chai.expect(updateExecutionStub.getCalls().length).to.be.equal(0);
          chai.expect(thenResult).to.be.eql({
            next: definition.Next,
            nextOpId: 'nextOpId',
            output: JSON.stringify(expectedOutput),
          });
        });
      });
    });
  });
});
