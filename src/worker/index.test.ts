import { Worker } from './index';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { getOperation } from '../core/operations';
import { mockLogger, mockQueueClient, mockRepo } from '../test-utilities';
import { QueueServiceClient } from '@maddonkeysoftware/mds-cloud-sdk-node/clients';

jest.mock('../core/operations');

describe('Worker', () => {
  // Setup mocks
  const mockOperation = {
    run: jest.fn(),
  };

  // Save original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));

    // Setup environment variables
    process.env = {
      ...originalEnv,
      IN_FLIGHT_QUEUE_NAME: 'test-in-flight-queue',
      PENDING_QUEUE_NAME: 'test-pending-queue',
      QUEUE_INTERVAL: '10',
    };

    // Setup mock returns
    (MdsSdk.getQueueServiceClient as jest.Mock).mockResolvedValue(
      mockQueueClient,
    );
    (getOperation as jest.Mock).mockImplementation(() => mockOperation);
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;

    jest.useRealTimers();
    jest.restoreAllMocks();

    // Ensure worker is stopped
    Worker.handleAppShutdown();
  });

  describe('startWorker', () => {
    it('should initialize the worker with provided dependencies', async () => {
      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Starting worker');
    });

    it('should initialize the worker with default dependencies when none provided', async () => {
      await Worker.startWorker();

      expect(MdsSdk.getQueueServiceClient).toHaveBeenCalled();
    });

    it('should handle errors during initialization', async () => {
      (MdsSdk.getQueueServiceClient as jest.Mock).mockRejectedValue(
        new Error('Connection error'),
      );

      await Worker.startWorker({
        logger: mockLogger,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to initialize queue client',
      );
    });

    it('should not start if already running', async () => {
      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      jest.clearAllMocks();

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('enqueueMessage', () => {
    it('should enqueue a message to the pending queue', async () => {
      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      const message = { executionId: 'exec1', operationId: 'op1' };
      await Worker.enqueueMessage(message);

      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'test-pending-queue',
        message,
      );
      expect(mockLogger.trace).toHaveBeenCalledWith(
        { message },
        'Enqueuing message',
      );
    });

    it('should use default queue name if environment variable not set', async () => {
      delete process.env.PENDING_QUEUE_NAME;

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      const message = { executionId: 'exec1', operationId: 'op1' };
      await Worker.enqueueMessage(message);

      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'PENDING_QUEUE_NAME environment variable not set',
        message,
      );
    });
  });

  describe('handleAppShutdown', () => {
    it('should stop the worker', async () => {
      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      Worker.handleAppShutdown();

      // We can't directly test the private running flag, but we can test
      // that starting the worker again works, which would only happen if
      // the worker was stopped
      jest.clearAllMocks();

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Starting worker');
    });
  });

  describe('private methods', () => {
    // We can test private methods indirectly by testing their effects
    // or by using the Worker's public methods that call them

    it('should process messages correctly', async () => {
      // This test requires access to private methods, so we'll test the behavior indirectly
      // by mocking the queue client and checking if messages are processed

      // Setup mock for fetchMessage to return a message once then null
      mockQueueClient.fetchMessage
        .mockResolvedValueOnce({
          id: 'msg1',
          message: JSON.stringify({ executionId: 'exec1', operationId: 'op1' }),
        })
        .mockResolvedValue(null);

      // Setup mock for getOperation
      mockRepo.getOperation.mockResolvedValue({
        id: 'op1',
        execution: 'exec1',
        input: {},
        output: {},
        stateKey: 'state1',
      });

      // Setup mock for getStateMachineDefinitionForExecution
      mockRepo.getStateMachineDefinitionForExecution.mockResolvedValue({
        States: {
          state1: {
            Type: 'Task',
            Resource: 'test-resource',
          },
        },
      });

      // Setup mock for operation run
      mockOperation.run.mockResolvedValue({
        output: { result: 'success' },
        next: false,
      });

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      // Give time for the async processing to occur
      await jest.advanceTimersByTimeAsync(50);

      expect(mockQueueClient.fetchMessage).toHaveBeenCalled();
      expect(mockQueueClient.deleteMessage).toHaveBeenCalled();
      expect(mockRepo.getOperation).toHaveBeenCalledWith('op1', 'exec1');
      expect(
        mockRepo.getStateMachineDefinitionForExecution,
      ).toHaveBeenCalledWith('exec1');
      expect(mockOperation.run).toHaveBeenCalled();
      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        'op1',
        'exec1',
        'Succeeded',
        { result: 'success' },
      );
    });

    it('should handle operation completion with next operation', async () => {
      // Setup mocks
      mockQueueClient.fetchMessage
        .mockResolvedValueOnce({
          id: 'msg1',
          message: JSON.stringify({ executionId: 'exec1', operationId: 'op1' }),
        })
        .mockResolvedValue(null);

      mockRepo.getOperation.mockResolvedValue({
        id: 'op1',
        execution: 'exec1',
        input: {},
        output: {},
        stateKey: 'state1',
      });

      mockRepo.getStateMachineDefinitionForExecution.mockResolvedValue({
        States: {
          state1: {
            Type: 'Task',
            Resource: 'test-resource',
            Next: 'state2',
          },
          state2: {
            Type: 'Task',
            Resource: 'test-resource-2',
          },
        },
      });

      mockOperation.run.mockResolvedValue({
        output: { result: 'success' },
        next: true,
        nextOpId: 'op2',
      });

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      // Give time for the async processing to occur
      await jest.advanceTimersByTimeAsync(50);

      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'test-in-flight-queue',
        { executionId: 'exec1', operationId: 'op2' },
      );
    });

    it('should handle errors during operation execution', async () => {
      // Setup mocks
      mockQueueClient.fetchMessage
        .mockResolvedValueOnce({
          id: 'msg1',
          message: JSON.stringify({ executionId: 'exec1', operationId: 'op1' }),
        })
        .mockResolvedValue(null);

      mockRepo.getOperation.mockResolvedValue({
        id: 'op1',
        execution: 'exec1',
        input: {},
        output: {},
        stateKey: 'state1',
      });

      mockRepo.getStateMachineDefinitionForExecution.mockResolvedValue({
        States: {
          state1: {
            Type: 'Task',
            Resource: 'test-resource',
          },
        },
      });

      mockOperation.run.mockRejectedValue(new Error('Operation failed'));

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      // Give time for the async processing to occur
      await jest.advanceTimersByTimeAsync(50);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to execute operation',
      );
    });

    it('should handle delayed operations', async () => {
      // Setup mocks
      mockRepo.getDelayedOperations.mockResolvedValue([
        {
          id: 'op1',
          execution: 'exec1',
          input: {},
          output: {},
          stateKey: 'state1',
        },
      ]);

      await Worker.startWorker({
        queueClient: mockQueueClient as unknown as QueueServiceClient,
        stateMachineRepo: mockRepo,
        logger: mockLogger,
      });

      // Give time for the async processing to occur
      await jest.advanceTimersByTimeAsync(50);

      expect(mockRepo.getDelayedOperations).toHaveBeenCalled();
      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        'op1',
        'exec1',
        'Pending',
        undefined,
      );
      expect(mockQueueClient.enqueueMessage).toHaveBeenCalledWith(
        'test-in-flight-queue',
        { executionId: 'exec1', operationId: 'op1' },
      );
    });
  });
});
