const chai = require('chai');
const sinon = require('sinon');

const globals = require('../globals');
const enums = require('../enums');
const repos = require('../repos');
const Choice = require('./choice');

describe('operations', () => {
  const buildChoice = (choices, defaultNext) => {
    const base = {
      Type: 'Choice',
      Choices: choices,
    };

    return defaultNext ? { ...base, Default: defaultNext } : { ...base };
  };

  beforeEach(() => {
    this.sandbox = sinon.createSandbox();
    this.sandbox.stub(globals, 'getLogger').returns(sinon.stub());
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe('choice', () => {
    it('Should throw exception when definition Type is not Choice', () => {
      // Arrange
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };

      // Act
      try {
        Choice.call({}, { Type: 'Task' }, metadata);
      } catch (err) {
        chai
          .expect(err.message)
          .to.be.equal('Attempted to use Task type for "Choice".');
      }
    });

    it('Should queue next operation and return payload when default set and no mach found.', () => {
      // Arrange
      const definition = buildChoice(
        [
          {
            Variable: '$.testMe',
            BooleanEquals: true,
            Next: 'Success',
          },
        ],
        'Default',
      );
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
        input: { testMe: false },
      };
      const op = new Choice(definition, metadata);
      const updateOperationStub = this.sandbox
        .stub(repos, 'updateOperation')
        .resolves();
      const createOperationStub = this.sandbox
        .stub(repos, 'createOperation')
        .resolves();
      this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

      // Act
      return op.run().then((result) => {
        // Assert
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
            metadata.input,
          ]);
        chai
          .expect(createOperationStub.getCall(0).args)
          .to.be.eql(['nextOpId', 'executionId', 'Default', metadata.input]);
        chai.expect(result).to.be.eql({
          next: 'Default',
          nextOpId: 'nextOpId',
          output: metadata.input,
        });
      });
    });

    it('Should fail operation and execution when default not set and no mach found.', () => {
      // Arrange
      const definition = buildChoice([
        {
          Variable: '$.testMe',
          BooleanEquals: true,
          Next: 'Success',
        },
      ]);
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
        input: { testMe: false },
      };
      const op = new Choice(definition, metadata);
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
      return op.run().then((result) => {
        // Assert
        chai.expect(updateOperationStub.getCalls().length).to.be.equal(2);
        chai.expect(createOperationStub.getCalls().length).to.be.equal(0);
        chai.expect(updateExecutionStub.getCalls().length).to.be.equal(1);
        chai
          .expect(updateOperationStub.getCall(0).args)
          .to.be.eql(['operationId', enums.OP_STATUS.Executing]);
        chai
          .expect(updateOperationStub.getCall(1).args)
          .to.be.eql(['operationId', enums.OP_STATUS.Failed]);
        chai
          .expect(updateExecutionStub.getCall(0).args)
          .to.be.eql(['executionId', enums.OP_STATUS.Failed]);
        chai.expect(result).to.be.eql({
          next: undefined,
          nextOpId: 'nextOpId',
          output: metadata.input,
        });
      });
    });

    describe('Should queue next operation and return payload when match found', () => {
      const performSuccessTest = (definition, metadata, nextKey) => {
        const op = new Choice(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((result) => {
          // Assert
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
              metadata.input,
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql(['nextOpId', 'executionId', nextKey, metadata.input]);
          chai.expect(result).to.be.eql({
            next: nextKey,
            nextOpId: 'nextOpId',
            output: metadata.input,
          });
        });
      };

      const performFailToDefaultTest = (definition, metadata) => {
        const op = new Choice(definition, metadata);
        const updateOperationStub = this.sandbox
          .stub(repos, 'updateOperation')
          .resolves();
        const createOperationStub = this.sandbox
          .stub(repos, 'createOperation')
          .resolves();
        this.sandbox.stub(globals, 'newUuid').returns('nextOpId');

        // Act
        return op.run().then((result) => {
          // Assert
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
              metadata.input,
            ]);
          chai
            .expect(createOperationStub.getCall(0).args)
            .to.be.eql([
              'nextOpId',
              'executionId',
              definition.Default,
              metadata.input,
            ]);
          chai.expect(result).to.be.eql({
            next: definition.Default,
            nextOpId: 'nextOpId',
            output: metadata.input,
          });
        });
      };

      describe('And operator', () => {
        // TODO: implement choice And operator
      });

      describe('BooleanEquals operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                BooleanEquals: true,
                Next: nextKey,
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: true },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                BooleanEquals: true,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: false },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('Not operator', () => {
        // TODO: implement choice Not operator
      });

      describe('NumericEquals operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericEquals: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericEquals: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 12 },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('NumericGreaterThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericGreaterThan: 20,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericGreaterThan: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('NumericGreaterThanEquals operator', () => {
        it('Successful match greater than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericGreaterThanEquals: 20,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericGreaterThanEquals: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericGreaterThanEquals: 25,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('NumericLessThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericLessThan: 30,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericLessThan: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('NumericLessThanEquals operator', () => {
        it('Successful match less than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericLessThanEquals: 30,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericLessThanEquals: 23,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                NumericLessThanEquals: 20,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 23 },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('Or operator', () => {
        // TODO: implement choice Or operator
      });

      describe('StringEquals operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringEquals: 'matchTest',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'matchTest' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringEquals: 'matchTest',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'matchTestFail' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('StringGreaterThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringGreaterThan: 'a',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'b' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringGreaterThan: 'a',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'a' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('StringGreaterThanEquals operator', () => {
        it('Successful match greater than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringGreaterThanEquals: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'b' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringGreaterThanEquals: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'b' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringGreaterThanEquals: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'a' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('StringLessThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringLessThan: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'a' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringLessThan: 'a',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'a' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('StringLessThanEquals operator', () => {
        it('Successful match greater than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringLessThanEquals: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'a' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringLessThanEquals: 'b',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'b' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                StringLessThanEquals: 'a',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: 'b' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('TimestampEquals operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const timeStamp = new Date().toISOString();
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampEquals: timeStamp,
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: timeStamp },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampEquals: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-10-19T19:23:14.403Z' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('TimestampGreaterThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampGreaterThan: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-20T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampGreaterThan: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('TimestampGreaterThanEquals operator', () => {
        it('Successful match greater than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampGreaterThanEquals: '2019-09-19T18:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampGreaterThanEquals: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampGreaterThanEquals: '2019-09-19T20:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('TimestampLessThan operator', () => {
        it('Successful match', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampLessThan: '2019-09-20T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampLessThan: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });

      describe('TimestampLessThanEquals operator', () => {
        it('Successful match greater than', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampLessThanEquals: '2019-09-19T20:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Successful match equals', () => {
          // Arrange
          const nextKey = 'Success';
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampLessThanEquals: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T19:23:14.403Z' },
          };
          return performSuccessTest(definition, metadata, nextKey);
        });

        it('Unsuccessful match', () => {
          // Arrange
          const definition = buildChoice(
            [
              {
                Variable: '$.testMe',
                TimestampLessThanEquals: '2019-09-19T19:23:14.403Z',
                Next: 'Success',
              },
            ],
            'default',
          );
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: '2019-09-19T20:23:14.403Z' },
          };
          return performFailToDefaultTest(definition, metadata);
        });
      });
    });
  });
});
