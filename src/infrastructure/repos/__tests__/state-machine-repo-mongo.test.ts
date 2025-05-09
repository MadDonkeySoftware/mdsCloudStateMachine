import { MongoClient, Collection } from 'mongodb';
import { BaseLogger } from 'pino';
import { v4 } from 'uuid';
import { DateTime } from 'luxon';
import { StateMachineRepoMongo } from '../state-machine-repo-mongo';
import { StateMachineDefinition } from '../../../core/types/state-machine-definition';
import {
  ExecutionData,
  StateMachineData,
  Status,
} from '../../../core/interfaces/state-machine-repo';

jest.mock('config', () => ({
  get: jest.fn().mockReturnValue('test-db'),
}));

jest.mock('uuid');
jest.mock('luxon');

describe('StateMachineRepoMongo', () => {
  let repo: StateMachineRepoMongo;
  let mockMongoClient: jest.Mocked<MongoClient>;
  let mockLogger: jest.Mocked<BaseLogger>;
  let mockCollection: jest.Mocked<Collection>;
  let mockDb: any;

  const mockUuid = 'mock-uuid-value';
  const mockDate = '2023-01-01T00:00:00.000Z';
  const mockAccountId = 'test-account';
  const mockResourceId = 'test-resource-id';
  const mockExecutionId = 'test-execution-id';
  const mockOperationId = 'test-operation-id';
  const mockVersionId = 'test-version-id';

  beforeEach(() => {
    jest.clearAllMocks();
    (v4 as jest.Mock).mockReturnValue(mockUuid);
    (DateTime.now as jest.Mock) = jest.fn().mockReturnValue({
      plus: jest.fn().mockReturnValue('mock-future-date'),
    });

    mockCollection = {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      toArray: jest.fn(),
    } as unknown as jest.Mocked<Collection>;

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    mockMongoClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MongoClient>;

    mockMongoClient.connect.mockResolvedValue(mockMongoClient);

    mockLogger = {
      warn: jest.fn(),
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<BaseLogger>;

    repo = new StateMachineRepoMongo({
      mongoClient: mockMongoClient,
      logger: mockLogger,
    });
  });

  describe('listStateMachines', () => {
    it('should return state machines for the given account', async () => {
      // Arrange
      const expectedStateMachines: StateMachineData[] = [
        {
          id: 'sm1',
          accountId: mockAccountId,
          name: 'Test State Machine 1',
          activeVersion: 'v1',
          isDeleted: false,
          versions: [{ id: 'v1', definition: {} as StateMachineDefinition }],
        },
      ];
      mockCollection.toArray.mockResolvedValue(expectedStateMachines);

      // Act
      const result = await repo.listStateMachines(mockAccountId);

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        accountId: mockAccountId,
      });
      expect(result).toEqual(expectedStateMachines);
    });
  });

  describe('createStateMachine', () => {
    it('should create a new state machine', async () => {
      // Arrange
      const definition: StateMachineDefinition = {
        Name: 'Test State Machine',
        StartAt: 'FirstState',
        States: {
          FirstState: {
            Type: 'Pass',
            End: true,
          },
        },
      };

      // Act
      const result = await repo.createStateMachine(mockAccountId, definition);

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        id: mockUuid,
        accountId: mockAccountId,
        name: definition.Name,
        activeVersion: mockUuid,
        isDeleted: false,
        versions: [
          {
            id: mockUuid,
            definition,
          },
        ],
      });

      expect(result).toEqual({
        id: mockUuid,
        accountId: mockAccountId,
        name: definition.Name,
        activeVersion: mockUuid,
        isDeleted: false,
        versions: [
          {
            id: mockUuid,
            definition,
          },
        ],
      });
    });
  });

  describe('getStateMachine', () => {
    it('should return the state machine if found', async () => {
      // Arrange
      const expectedStateMachine: StateMachineData = {
        id: mockResourceId,
        accountId: mockAccountId,
        name: 'Test State Machine',
        activeVersion: 'v1',
        isDeleted: false,
        versions: [{ id: 'v1', definition: {} as StateMachineDefinition }],
      };
      mockCollection.findOne.mockResolvedValue(expectedStateMachine);

      // Act
      const result = await repo.getStateMachine(mockAccountId, mockResourceId);

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        id: mockResourceId,
        accountId: mockAccountId,
        isDeleted: false,
      });
      expect(result).toEqual(expectedStateMachine);
    });

    it('should return null if state machine not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValue(null);

      // Act
      const result = await repo.getStateMachine(mockAccountId, mockResourceId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateStateMachine', () => {
    it('should update the state machine and return the updated version', async () => {
      // Arrange
      const definition: StateMachineDefinition = {
        Name: 'Updated State Machine',
        StartAt: 'FirstState',
        States: {
          FirstState: {
            Type: 'Pass',
            End: true,
          },
        },
      };

      const updatedStateMachine: StateMachineData = {
        id: mockResourceId,
        accountId: mockAccountId,
        name: 'Updated State Machine',
        activeVersion: mockUuid,
        isDeleted: false,
        versions: [
          { id: 'old-version', definition: {} as StateMachineDefinition },
          { id: mockUuid, definition },
        ],
      };

      mockCollection.updateOne.mockResolvedValue({ matchedCount: 1 } as any);

      // Mock the getStateMachine call that happens inside updateStateMachine
      jest
        .spyOn(repo, 'getStateMachine')
        .mockResolvedValue(updatedStateMachine);

      // Act
      const result = await repo.updateStateMachine(
        mockAccountId,
        mockResourceId,
        definition,
      );

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          id: mockResourceId,
          accountId: mockAccountId,
        },
        {
          $set: {
            activeVersion: mockUuid,
          },
          $addToSet: {
            versions: {
              id: mockUuid,
              definition,
            },
          },
        },
      );
      expect(repo.getStateMachine).toHaveBeenCalledWith(
        mockAccountId,
        mockResourceId,
      );
      expect(result).toEqual(updatedStateMachine);
    });
  });

  describe('removeStateMachine', () => {
    it('should mark the state machine as deleted', async () => {
      // Arrange
      const mockExpires = 'mock-future-date';

      // Act
      await repo.removeStateMachine(mockAccountId, mockResourceId);

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          id: mockResourceId,
          accountId: mockAccountId,
        },
        {
          $set: {
            isDeleted: true,
            removeAt: mockExpires,
          },
        },
      );
    });
  });

  describe('createExecution', () => {
    it('should create a new execution', async () => {
      // Arrange
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);

      // Act
      await repo.createExecution(
        mockExecutionId,
        mockResourceId,
        mockVersionId,
      );

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [],
      });
    });
  });

  describe('updateExecution', () => {
    it('should update the execution status', async () => {
      // Arrange
      const status: Status = 'Succeeded';

      // Act
      await repo.updateExecution(mockExecutionId, status);

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: mockExecutionId },
        {
          $set: { status },
        },
      );
    });
  });

  describe('getExecution', () => {
    it('should return the execution if found', async () => {
      // Arrange
      const expectedExecution: ExecutionData = {
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [],
      };
      mockCollection.findOne.mockResolvedValue(expectedExecution);

      // Act
      const result = await repo.getExecution(mockExecutionId);

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        id: mockExecutionId,
      });
      expect(result).toEqual(expectedExecution);
    });

    it('should return null if execution not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValue(null);

      // Act
      const result = await repo.getExecution(mockExecutionId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getStateMachineDefinitionForExecution', () => {
    it('should return the definition for the execution', async () => {
      // Arrange
      const definition: StateMachineDefinition = {
        Name: 'Test State Machine',
        StartAt: 'FirstState',
        States: {
          FirstState: {
            Type: 'Pass',
            End: true,
          },
        },
      };

      const execution: ExecutionData = {
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [],
      };

      const stateMachine: StateMachineData = {
        id: mockResourceId,
        accountId: mockAccountId,
        name: 'Test State Machine',
        activeVersion: 'v1',
        isDeleted: false,
        versions: [{ id: mockVersionId, definition }],
      };

      // Mock the collections.findOne calls
      mockCollection.findOne
        .mockResolvedValueOnce(execution)
        .mockResolvedValueOnce(stateMachine);

      // Act
      const result =
        await repo.getStateMachineDefinitionForExecution(mockExecutionId);

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        id: mockExecutionId,
      });
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        id: mockResourceId,
      });
      expect(result).toEqual(definition);
    });

    it('should throw an error if execution not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        repo.getStateMachineDefinitionForExecution(mockExecutionId),
      ).rejects.toThrow(`Execution ${mockExecutionId} not found`);
    });

    it('should throw an error if version not found', async () => {
      // Arrange
      const execution: ExecutionData = {
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [],
      };

      const stateMachine: StateMachineData = {
        id: mockResourceId,
        accountId: mockAccountId,
        name: 'Test State Machine',
        activeVersion: 'v1',
        isDeleted: false,
        versions: [
          { id: 'different-version', definition: {} as StateMachineDefinition },
        ],
      };

      mockCollection.findOne
        .mockResolvedValueOnce(execution)
        .mockResolvedValueOnce(stateMachine);

      // Act & Assert
      await expect(
        repo.getStateMachineDefinitionForExecution(mockExecutionId),
      ).rejects.toThrow(`Version ${mockVersionId} not found`);
    });
  });

  describe('createOperation', () => {
    it('should create a new operation', async () => {
      // Arrange
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
      const stateKey = 'FirstState';
      const input = { data: 'test-input' };

      // Act
      await repo.createOperation(
        mockOperationId,
        mockExecutionId,
        stateKey,
        input,
      );

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: mockExecutionId },
        {
          $addToSet: {
            operations: {
              id: mockOperationId,
              created: mockDate,
              stateKey,
              status: 'Pending',
              input,
              output: null,
            },
          },
        },
      );
    });
  });

  describe('updateOperation', () => {
    it('should update the operation status and output', async () => {
      // Arrange
      const status: Status = 'Succeeded';
      const output = { data: 'test-output' };

      // Act
      await repo.updateOperation(
        mockOperationId,
        mockExecutionId,
        status,
        output,
      );

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: mockExecutionId, 'operations.id': mockOperationId },
        {
          $set: {
            'operations.$.status': status,
            'operations.$.output': output,
          },
        },
      );
    });
  });

  describe('delayOperation', () => {
    it('should update the operation to waiting status with waitUntilUtc', async () => {
      // Arrange
      const waitUntilUtc = 1672531200; // 2023-01-01 00:00:00 UTC

      // Act
      await repo.delayOperation(mockOperationId, mockExecutionId, waitUntilUtc);

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { id: mockExecutionId, 'operations.id': mockOperationId },
        {
          $set: {
            'operations.$.status': 'Waiting',
            'operations.$.waitUntilUtc': waitUntilUtc,
          },
        },
      );
    });
  });

  describe('getOperation', () => {
    it('should return the operation if found', async () => {
      // Arrange
      const operation = {
        id: mockOperationId,
        created: mockDate,
        stateKey: 'FirstState',
        status: 'Pending',
        input: { data: 'test-input' },
        output: null,
      };

      const execution: ExecutionData = {
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [operation],
      };

      mockCollection.findOne.mockResolvedValue(execution);

      // Act
      const result = await repo.getOperation(mockOperationId, mockExecutionId);

      // Assert
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        id: mockExecutionId,
      });
      expect(result).toEqual({ ...operation, execution: mockExecutionId });
    });

    it('should throw an error if execution not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        repo.getOperation(mockOperationId, mockExecutionId),
      ).rejects.toThrow(`Execution ${mockExecutionId} not found`);
    });

    it('should throw an error if operation not found', async () => {
      // Arrange
      const execution: ExecutionData = {
        id: mockExecutionId,
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [],
      };

      mockCollection.findOne.mockResolvedValue(execution);

      // Act & Assert
      await expect(
        repo.getOperation(mockOperationId, mockExecutionId),
      ).rejects.toThrow(`Operation ${mockOperationId} not found`);
    });
  });

  describe('getDelayedOperations', () => {
    it('should return operations that are waiting and past their waitUntilUtc', async () => {
      // Arrange
      const waitUntilUtc = 1672531200; // 2023-01-01 00:00:00 UTC
      const currentTime = waitUntilUtc + 100; // 100 seconds later

      const execution1: ExecutionData = {
        id: 'execution1',
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [
          {
            id: 'op1',
            created: mockDate,
            stateKey: 'WaitState',
            status: 'Waiting',
            waitUntilUtc: waitUntilUtc - 50, // Past the time
            input: {},
            output: null,
          },
          {
            id: 'op2',
            created: mockDate,
            stateKey: 'WaitState',
            status: 'Waiting',
            waitUntilUtc: waitUntilUtc + 200, // Future time
            input: {},
            output: null,
          },
        ],
      };

      const execution2: ExecutionData = {
        id: 'execution2',
        created: mockDate,
        status: 'Pending',
        stateMachine: mockResourceId,
        version: mockVersionId,
        operations: [
          {
            id: 'op3',
            created: mockDate,
            stateKey: 'WaitState',
            status: 'Waiting',
            waitUntilUtc: waitUntilUtc - 100, // Past the time
            input: {},
            output: null,
          },
          {
            id: 'op4',
            created: mockDate,
            stateKey: 'WaitState',
            status: 'Succeeded', // Not waiting
            waitUntilUtc: waitUntilUtc - 200,
            input: {},
            output: null,
          },
        ],
      };

      mockCollection.find.mockReturnThis();
      mockCollection.toArray.mockResolvedValue([execution1, execution2]);

      // Act
      const result = await repo.getDelayedOperations(currentTime);

      // Assert
      expect(mockCollection.find).toHaveBeenCalledWith({
        'operations.waitUntilUtc': { $lte: currentTime },
      });
      expect(result).toEqual([
        { execution: 'execution1', id: 'op1' },
        { execution: 'execution2', id: 'op3' },
      ]);
    });

    it('should return an empty array if no delayed operations found', async () => {
      // Arrange
      const waitUntilUtc = 1672531200;
      mockCollection.find.mockReturnThis();
      mockCollection.toArray.mockResolvedValue([]);

      // Act
      const result = await repo.getDelayedOperations(waitUntilUtc);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('handleAppShutdown', () => {
    it('should close the MongoDB connection', async () => {
      // Act
      await repo.handleAppShutdown();

      // Assert
      expect(mockMongoClient.close).toHaveBeenCalled();
    });
  });
});
