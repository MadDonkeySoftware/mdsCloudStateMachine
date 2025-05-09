import { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../../../index';
import { asFunction, Lifetime } from 'awilix';
import { Logic } from '../../../../core/classes/logic';
import { StateMachineDefinition } from '../../../../core/types/state-machine-definition';
import { NotFound } from '../../../../core/errors/not-found';

jest.mock('../../../hooks/validate-token', () => {
  return {
    validateToken: jest.fn().mockImplementation((req, res, next) => {
      req.parsedToken = {
        payload: {
          accountId: 'testAccountId',
        },
      };
      next();
    }),
  };
});

describe('state machine controller test', () => {
  let app: FastifyInstance;
  const logicMock = {
    createStateMachine: jest.fn(),
    getStateMachine: jest.fn(),
    updateStateMachine: jest.fn(),
    listStateMachines: jest.fn(),
    removeStateMachine: jest.fn(),
    invokeStateMachine: jest.fn(),
    getExecutionDetails: jest.fn(),

    // @ts-expect-error - Mocking private attribute
  } satisfies Logic;
  const testStateMachineOrid =
    'orid:1:testIssuer:::testAccountId:sm:testStateMachine';
  const testMachine = {
    id: 'testStateMachine',
    name: 'testName',
    isDeleted: false,
    activeVersion: 'testVersion',
    versions: [
      {
        id: 'testVersion',
        definition: {
          Name: 'testName',
          StartAt: 'Foo',
          States: { Foo: { Type: 'Success' } },
        } as StateMachineDefinition,
      },
    ],
  };

  function makeRequest(overrides: InjectOptions = {}) {
    return app.inject({
      ...({
        url: '/',
        method: 'GET',
      } satisfies InjectOptions),
      ...overrides,
    });
  }

  beforeAll(async () => {
    app = await buildApp(({ diContainer }) => {
      diContainer.register({
        logic: asFunction(() => logicMock, {
          lifetime: Lifetime.SCOPED,
        }),
      });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list machines', () => {
    it('properly lists state machines', async () => {
      // Arrange
      logicMock.listStateMachines.mockResolvedValue([testMachine]);

      // Act
      const response = await makeRequest({
        method: 'GET',
        url: '/v1/machines',
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        {
          ...testMachine,
          orid: testStateMachineOrid,
          versions: undefined,
        },
      ]);
    });
  });

  describe('get machine', () => {
    it('properly gets a state machine by id', async () => {
      // Arrange
      logicMock.getStateMachine.mockResolvedValue(testMachine);

      // Act
      const response = await makeRequest({
        method: 'GET',
        url: `/v1/machine/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: testMachine.name,
        orid: testStateMachineOrid,
        definition: { Name: 'testName' },
      });
      expect(logicMock.getStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        testMachine.id,
      );
    });

    it('returns 404 when state machine is not found', async () => {
      // Arrange
      logicMock.getStateMachine.mockResolvedValue(null);

      // Act
      const response = await makeRequest({
        method: 'GET',
        url: `/v1/machines/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('create machine', () => {
    it('properly creates a state machine', async () => {
      // Arrange
      const newDefinition = {
        Name: 'test-name',
        StartAt: 'Start',
        States: {
          Start: {
            Type: 'Success',
          },
        },
      } as StateMachineDefinition;
      const newMachine = {
        id: 'test-id',
        name: 'test-name',
        isDeleted: false,
        activeVersion: 'test-version',
        versions: [
          {
            id: 'test-version',
            definition: newDefinition,
          },
        ],
      };
      logicMock.createStateMachine.mockResolvedValue(newMachine);

      // Act
      const response = await makeRequest({
        method: 'POST',
        url: '/v1/machine',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        payload: newDefinition,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ...newMachine,
        orid: 'orid:1:testIssuer:::testAccountId:sm:test-id',
      });
      expect(logicMock.createStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        newDefinition,
      );
    });
  });

  describe('update machine', () => {
    it('properly updates a state machine', async () => {
      // Arrange
      logicMock.updateStateMachine.mockResolvedValue(testMachine);

      // Act
      const response = await makeRequest({
        method: 'POST',
        url: `/v1/machine/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        payload: testMachine.versions[0].definition,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ...testMachine,
        orid: testStateMachineOrid,
        definition: testMachine.versions[0].definition,
        versions: undefined,
      });
      expect(logicMock.updateStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        testMachine.id,
        testMachine.versions[0].definition,
      );
    });

    it('returns 404 when updating a non-existent state machine', async () => {
      // Arrange
      const testDefinition = { Name: 'updated-name' } as StateMachineDefinition;
      logicMock.updateStateMachine.mockResolvedValue(null);

      // Act
      const response = await makeRequest({
        method: 'POST',
        url: `/v1/machine/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        payload: testDefinition,
      });

      // Assert
      expect(response.statusCode).toBe(404);
      expect(logicMock.updateStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        'testStateMachine',
        testDefinition,
      );
    });
  });

  describe('delete machine', () => {
    it('properly deletes a state machine', async () => {
      // Arrange
      logicMock.getStateMachine.mockResolvedValueOnce(testMachine);
      logicMock.removeStateMachine.mockResolvedValueOnce(true);

      // Act
      const response = await makeRequest({
        method: 'DELETE',
        url: `/v1/machine/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(204);
      expect(logicMock.removeStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        testMachine.id,
      );
    });

    it('returns 404 when deleting a non-existent state machine', async () => {
      // Act
      const response = await makeRequest({
        method: 'DELETE',
        url: `/v1/machine/${testStateMachineOrid}`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('invoke state machine', () => {
    it('properly invokes a state machine', async () => {
      // Arrange
      const executionId = 'test-execution-id';
      const inputData = { key: 'value' };
      logicMock.invokeStateMachine.mockResolvedValue({ executionId });

      // Act
      const response = await makeRequest({
        method: 'POST',
        url: `/v1/machine/${testStateMachineOrid}/invoke`,
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        payload: inputData,
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        orid: `${testStateMachineOrid}/${executionId}`,
      });
      expect(logicMock.invokeStateMachine).toHaveBeenCalledWith(
        'testAccountId',
        testMachine.id,
        inputData,
      );
    });

    it('returns 404 when invoking a non-existent state machine', async () => {
      // Arrange
      logicMock.invokeStateMachine.mockRejectedValueOnce(
        new NotFound('Test error'),
      );

      // Act
      const response = await makeRequest({
        method: 'POST',
        url: `/v1/machine/${testStateMachineOrid}/invoke`,
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('get execution details', () => {
    it('properly gets execution details', async () => {
      // Arrange
      const executionId = 'test-execution-id';
      const executionDetails = {
        id: executionId,
        status: 'Succeeded',
        created: '2023-01-01T00:00:00Z',
        input: { key: 'value' },
        output: { result: 'success' },
        operations: [
          {
            created: '2023-01-01T00:00:00Z',
            stateKey: 'Task',
            status: 'Success',
            input: { key: 'value' },
            output: { result: 'success' },
          },
        ],
      };
      logicMock.getExecutionDetails.mockResolvedValue(executionDetails);

      // Act
      const response = await makeRequest({
        method: 'GET',
        url: `/v1/execution/${testStateMachineOrid}/${executionId}`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ...executionDetails,
        id: undefined,
        created: undefined,
        input: undefined,
        output: undefined,
        orid: `${testStateMachineOrid}/${executionId}`,
      });
      expect(logicMock.getExecutionDetails).toHaveBeenCalledWith(
        'testAccountId',
        executionId,
      );
    });

    it('returns 404 when execution is not found', async () => {
      // Arrange
      logicMock.getExecutionDetails.mockResolvedValue(null);

      // Act
      const response = await makeRequest({
        method: 'GET',
        url: `/v1/execution/${testStateMachineOrid}/test-execution-id`,
        headers: {
          authorization: 'Bearer test-token',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });
});
