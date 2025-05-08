import { Logic } from '../logic';
import { StateMachineDefinition } from '../../types/state-machine-definition';
import { NotFound } from '../../errors/not-found';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { v4 as uuidv4 } from 'uuid';
import { mockQueueClient, mockRepo } from '../../../test-utilities';

// Mock the uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

// Mock the MdsSdk
jest.mock('@maddonkeysoftware/mds-cloud-sdk-node', () => ({
  MdsSdk: {
    getQueueServiceClient: jest.fn(),
  },
}));

describe('Logic', () => {
  let logic: Logic;

  beforeEach(() => {
    // Mock the MdsSdk.getQueueServiceClient
    (MdsSdk.getQueueServiceClient as jest.Mock).mockResolvedValue(
      mockQueueClient,
    );

    // Create Logic instance with mock repo
    logic = new Logic({ stateMachineRepo: mockRepo });

    // Store original env and set queue name
    process.env.PENDING_QUEUE_NAME = 'test-queue';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listStateMachines', () => {
    it('should call repo.listStateMachines with accountId', async () => {
      const accountId = 'test-account';
      const expectedResult = [{ id: 'sm1' }, { id: 'sm2' }];

      mockRepo.listStateMachines.mockResolvedValue(expectedResult);

      const result = await logic.listStateMachines(accountId);

      expect(mockRepo.listStateMachines).toHaveBeenCalledWith(accountId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createStateMachine', () => {
    it('should call repo.createStateMachine with accountId and definition', async () => {
      const accountId = 'test-account';
      const definition: StateMachineDefinition = {
        Name: 'Test state machine',
        StartAt: 'FirstState',
        States: {
          FirstState: {
            Type: 'Task',
            Resource: 'test-resource',
          },
        },
      };
      const expectedResult = { id: 'new-sm', accountId, definition };

      mockRepo.createStateMachine.mockResolvedValue(expectedResult);

      const result = await logic.createStateMachine(accountId, definition);

      expect(mockRepo.createStateMachine).toHaveBeenCalledWith(
        accountId,
        definition,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateStateMachine', () => {
    it('should call repo.updateStateMachine with accountId, resourceId and definition', async () => {
      const accountId = 'test-account';
      const resourceId = 'test-resource';
      const definition: StateMachineDefinition = {
        Name: 'Updated state machine',
        StartAt: 'FirstState',
        States: {
          FirstState: {
            Type: 'Task',
            Resource: 'test-resource',
          },
        },
      };
      const expectedResult = { id: resourceId, accountId, definition };

      mockRepo.updateStateMachine.mockResolvedValue(expectedResult);

      const result = await logic.updateStateMachine(
        accountId,
        resourceId,
        definition,
      );

      expect(mockRepo.updateStateMachine).toHaveBeenCalledWith(
        accountId,
        resourceId,
        definition,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getStateMachine', () => {
    it('should call repo.getStateMachine with accountId and resourceId', async () => {
      const accountId = 'test-account';
      const resourceId = 'test-resource';
      const expectedResult = { id: resourceId, accountId };

      mockRepo.getStateMachine.mockResolvedValue(expectedResult);

      const result = await logic.getStateMachine(accountId, resourceId);

      expect(mockRepo.getStateMachine).toHaveBeenCalledWith(
        accountId,
        resourceId,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeStateMachine', () => {
    it('should call repo.removeStateMachine with accountId and resourceId', async () => {
      const accountId = 'test-account';
      const resourceId = 'test-resource';

      mockRepo.removeStateMachine.mockResolvedValue(true);

      const result = await logic.removeStateMachine(accountId, resourceId);

      expect(mockRepo.removeStateMachine).toHaveBeenCalledWith(
        accountId,
        resourceId,
      );
      expect(result).toBe(true);
    });
  });

  describe('invokeStateMachine', () => {
    it('should create execution, operation and enqueue message when state machine exists', async () => {
      // Set up UUID mock values for this specific test
      const mockExecutionId = 'mock-execution-id';
      const mockOperationId = 'mock-operation-id';
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce(mockExecutionId)
        .mockReturnValueOnce(mockOperationId);

      const accountId = 'test-account';
      const resourceId = 'test-resource';
      const input = { data: 'test-input' };
      const activeVersion = 'v1';
      const startAt = 'FirstState';

      const stateMachine = {
        id: resourceId,
        accountId,
        activeVersion,
        versions: [
          {
            id: activeVersion,
            definition: {
              StartAt: startAt,
            },
          },
        ],
      };

      mockRepo.getStateMachine.mockResolvedValue(stateMachine);
      mockRepo.createExecution.mockResolvedValue(undefined);
      mockRepo.createOperation.mockResolvedValue(undefined);

      const result = await logic.invokeStateMachine(
        accountId,
        resourceId,
        input,
      );

      expect(mockRepo.getStateMachine).toHaveBeenCalledWith(
        accountId,
        resourceId,
      );
      expect(mockRepo.createExecution).toHaveBeenCalledWith(
        mockExecutionId,
        resourceId,
        activeVersion,
      );
      expect(mockRepo.createOperation).toHaveBeenCalledWith(
        mockOperationId,
        mockExecutionId,
        startAt,
        input,
      );
      expect(MdsSdk.getQueueServiceClient).toHaveBeenCalled();
      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'test-queue',
        {
          executionId: mockExecutionId,
          operationId: mockOperationId,
          fromInvoke: true,
        },
      );
      expect(result).toEqual({ executionId: mockExecutionId });
    });

    it('should throw NotFound when state machine does not exist', async () => {
      const accountId = 'test-account';
      const resourceId = 'test-resource';
      const input = { data: 'test-input' };

      mockRepo.getStateMachine.mockResolvedValue(null);

      await expect(
        logic.invokeStateMachine(accountId, resourceId, input),
      ).rejects.toThrow(NotFound);

      expect(mockRepo.getStateMachine).toHaveBeenCalledWith(
        accountId,
        resourceId,
      );
      expect(mockRepo.createExecution).not.toHaveBeenCalled();
      expect(mockRepo.createOperation).not.toHaveBeenCalled();
      expect(mockQueueClient.enqueueMessage).not.toHaveBeenCalled();
    });

    it('should use default queue name when env var is not set', async () => {
      // Set up UUID mock values for this specific test
      const mockExecutionId = 'mock-execution-id-2';
      const mockOperationId = 'mock-operation-id-2';
      (uuidv4 as jest.Mock)
        .mockReturnValueOnce(mockExecutionId)
        .mockReturnValueOnce(mockOperationId);

      const accountId = 'test-account';
      const resourceId = 'test-resource';
      const input = { data: 'test-input' };
      const activeVersion = 'v1';
      const startAt = 'FirstState';

      const stateMachine = {
        id: resourceId,
        accountId,
        activeVersion,
        versions: [
          {
            id: activeVersion,
            definition: {
              StartAt: startAt,
            },
          },
        ],
      };

      // Remove env var to test default
      delete process.env.PENDING_QUEUE_NAME;

      mockRepo.getStateMachine.mockResolvedValue(stateMachine);
      mockRepo.createExecution.mockResolvedValue(undefined);
      mockRepo.createOperation.mockResolvedValue(undefined);

      await logic.invokeStateMachine(accountId, resourceId, input);

      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'PENDING_QUEUE_NAME NOT SET',
        expect.any(Object),
      );
    });
  });

  describe('getExecutionDetails', () => {
    it('should call repo.getExecution with resourceId', async () => {
      const accountId = 'test-account';
      const resourceId = 'test-execution';
      const expectedResult = { id: resourceId, status: 'RUNNING' };

      mockRepo.getExecution.mockResolvedValue(expectedResult);

      const result = await logic.getExecutionDetails(accountId, resourceId);

      expect(mockRepo.getExecution).toHaveBeenCalledWith(resourceId);
      expect(result).toEqual(expectedResult);
    });
  });
});
