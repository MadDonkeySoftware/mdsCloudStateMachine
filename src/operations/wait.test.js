const _ = require('lodash');
const chai = require('chai');
const chaiExclude = require('chai-exclude');
const sinon = require('sinon');

const globals = require('../globals');
const repos = require('../repos');
const Wait = require('./wait');

chai.use(chaiExclude);

describe('operations', () => {
  const buildWait = (overrides) =>
    _.merge(
      {},
      {
        Type: 'Wait',
        Resource: 'orid:1::::1:sf:some-id',
      },
      overrides,
    );

  beforeEach(() => {
    this.sandbox = sinon.createSandbox();

    // Couldn't get this syntax to work but below did *shrug*: this.sandbox.stub(globals, 'logger');
    // globals.logger = this.sandbox.stub(globals.logger);
    this.sandbox.stub(globals, 'getLogger').returns(sinon.stub());
  });

  afterEach(() => {
    this.sandbox.restore();
  });

  describe('wait', () => {
    it('Should throw exception when definition Type is not Wait', () => {
      // Arrange
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };

      // Act
      try {
        Wait.call({}, { Type: 'Task' }, metadata);
      } catch (err) {
        chai
          .expect(err.message)
          .to.be.equal('Attempted to use Task type for "Wait".');
      }
    });

    it('Should throw exception when underlying operation throws exception.', () => {
      // Arrange
      const definition = buildWait({ Next: { Type: 'Succeed' }, Seconds: 1 });
      const metadata = {
        id: 'operationId',
        execution: 'executionId',
      };
      const op = new Wait(definition, metadata);
      this.sandbox.stub(repos, 'getOperation').resolves({});
      this.sandbox
        .stub(repos, 'delayOperation')
        .rejects(new Error('test error'));

      // Act
      return op.run().catch((err) => {
        // Assert
        chai.expect(err.message).to.be.eql('test error');
      });
    });
  });
});
