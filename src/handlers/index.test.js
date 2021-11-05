const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');
const jwt = require('jsonwebtoken');

const src = require('..');
const repos = require('../repos');
const handlerHelpers = require('./handler-helpers');

describe('src/handlers/index', () => {
  beforeEach(() => {
    sinon.stub(handlerHelpers, 'getIssuer').returns('testIssuer');
    sinon
      .stub(handlerHelpers, 'getAppPublicSignature')
      .resolves('publicSignature');
    sinon.stub(jwt, 'verify').returns({
      payload: {
        iss: 'testIssuer',
        accountId: '1',
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('rejects request when id not orid', () => {
    // Arrange
    const app = src.buildApp();

    // Act / Assert
    return supertest(app)
      .get('/v1/machine/test')
      .set('token', 'testToken')
      .expect(400)
      .then((resp) => {
        chai.expect(resp.text).to.eql('resource not understood');
      });
  });

  describe('list machines', () => {
    it('provides the root url', () => {
      // Arrange
      const app = src.buildApp();
      const stateMachines = [
        {
          id: 1,
          name: 'fooBar',
        },
      ];
      sinon.stub(repos, 'getStateMachines').resolves(stateMachines);

      // Act / Assert
      return supertest(app)
        .get('/v1/machines')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);
          chai.expect(body).to.deep.eql([
            {
              id: 1,
              name: 'fooBar',
              orid: 'orid:1::::1:sm:1',
            },
          ]);
        });
    });
  });

  describe('get details', () => {
    it('provides the root url', () => {
      // Arrange
      const app = src.buildApp();
      const stateMachines = {
        id: 'test',
        name: 'fooBar',
      };
      sinon
        .stub(repos, 'getStateMachine')
        .withArgs('test')
        .resolves(stateMachines);

      // Act / Assert
      return supertest(app)
        .get('/v1/machine/orid:1:mdsCloud:::1:sm:test')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);
          chai.expect(body).to.deep.eql({
            name: 'fooBar',
            orid: 'orid:1::::1:sm:test',
          });
        });
    });
  });
});
