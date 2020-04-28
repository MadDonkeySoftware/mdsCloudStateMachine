const supertest = require('supertest');
const sinon = require('sinon');
const chai = require('chai');

const src = require('..');
const repos = require('../repos');

describe('src/handlers/index', () => {
  it('provides the root url', () => {
    // Arrange
    const app = src.buildApp();
    const expectedResult = [{
      id: 1,
      name: 'fooBar',
    }];
    sinon.stub(repos, 'getStateMachines').resolves(expectedResult);

    // Act / Assert
    return supertest(app)
      .get('/machines')
      .expect('content-type', /application\/json/)
      .expect(200)
      .then((resp) => {
        const body = JSON.parse(resp.text);
        chai.expect(body).to.eql(expectedResult);
      });
  });
});
