const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');

const src = require('..');
const repos = require('../repos');

describe('src/handlers/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('rejects request when id not orid', () => {
    // Arrange
    const app = src.buildApp();

    // Act / Assert
    return supertest(app)
      .get('/v1/machine/test')
      .expect('content-type', /application\/json/)
      .expect(400)
      .then((resp) => {
        chai.expect(resp.text).to.eql('');
      });
  });

  describe('list machines', () => {
    it('provides the root url', () => {
      // Arrange
      const app = src.buildApp();
      const stateMachines = [{
        id: 1,
        name: 'fooBar',
      }];
      sinon.stub(repos, 'getStateMachines').resolves(stateMachines);

      // Act / Assert
      return supertest(app)
        .get('/v1/machines')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);
          chai.expect(body).to.deep.eql([{
            id: 1,
            name: 'fooBar',
            orid: 'orid:1:mdsCloud:::1:sm:1',
          }]);
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
      sinon.stub(repos, 'getStateMachine').withArgs('test').resolves(stateMachines);

      // Act / Assert
      return supertest(app)
        .get('/v1/machine/orid:1:mdsCloud:::1:sm:test')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);
          chai.expect(body).to.deep.eql({
            id: 'test',
            name: 'fooBar',
            orid: 'orid:1:mdsCloud:::1:sm:test',
          });
        });
    });
  });
});
