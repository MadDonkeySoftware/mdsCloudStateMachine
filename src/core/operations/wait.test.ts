import { Wait } from './wait';
import { WaitState } from '../types/state-machine-definition';
import { mockLogger, mockRepo } from '../../test-utilities';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('Wait', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error for invalid definition', () => {
      expect(() => {
        new Wait(
          { Type: 'Task' } as unknown as WaitState,
          { id: '123', execution: '456', input: {}, output: {} },
          mockRepo,
          mockLogger,
        );
      }).toThrow('Invalid definition');
    });

    it('should throw error for invalid metadata', () => {
      expect(() => {
        new Wait(
          { Type: 'Wait', Next: 'NextState' },
          null as any,
          mockRepo,
          mockLogger,
        );
      }).toThrow('Invalid metadata');
    });

    it('should initialize with valid parameters', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      expect(wait).toBeInstanceOf(Wait);
    });
  });

  describe('getValueFromPath', () => {
    it('should return value from nested path', () => {
      const source = { a: { b: { c: 'value' } } };
      const result = Wait.getValueFromPath(source, 'a.b.c');
      expect(result).toBe('value');
    });

    it('should return undefined for non-existent path', () => {
      const source = { a: { b: { c: 'value' } } };
      const result = Wait.getValueFromPath(source, 'a.b.d');
      expect(result).toBeUndefined();
    });

    it('should handle empty source', () => {
      const result = Wait.getValueFromPath(null, 'a.b.c');
      expect(result).toBeNull();
    });
  });

  describe('computeWaitTimestamp', () => {
    it('should compute timestamp using Seconds', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      // Current time is 2023-01-01T00:00:00Z (1672531200 in epoch seconds)
      // Adding 10 seconds should give 1672531210
      expect(wait.computeWaitTimestamp()).toBe(1672531210);
    });

    it('should compute timestamp using SecondsPath', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', SecondsPath: 'wait.seconds' },
        {
          id: '123',
          execution: '456',
          input: { wait: { seconds: 20 } },
          output: {},
        },
        mockRepo,
        mockLogger,
      );

      // Current time is 2023-01-01T00:00:00Z (1672531200 in epoch seconds)
      // Current time + 20 seconds = 1672531220
      expect(wait.computeWaitTimestamp()).toBe(1672531220);
    });

    it('should compute timestamp using Timestamp', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Timestamp: '2023-01-01T00:01:00Z' },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      // 2023-01-01T00:01:00Z = 1672531260 in epoch seconds
      expect(wait.computeWaitTimestamp()).toBe(1672531260);
    });

    it('should compute timestamp using TimestampPath', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', TimestampPath: 'wait.timestamp' },
        {
          id: '123',
          execution: '456',
          input: { wait: { timestamp: '2023-01-01T00:02:00Z' } },
          output: {},
        },
        mockRepo,
        mockLogger,
      );

      // 2023-01-01T00:02:00Z = 1672531320 in epoch seconds
      expect(wait.computeWaitTimestamp()).toBe(1672531320);
    });

    it('should throw error if no timestamp can be computed', () => {
      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState' },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      expect(() => wait.computeWaitTimestamp()).toThrow(
        'Could not compute timestamp.',
      );
    });
  });

  describe('run', () => {
    it('should throw error if operation not found', async () => {
      mockRepo.getOperation.mockResolvedValue(null);

      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      await expect(wait.run()).rejects.toThrow('Operation not found: 456-123');
    });

    it('should delay operation if wait time not reached', async () => {
      mockRepo.getOperation.mockResolvedValue({
        id: '123',
        execution: '456',
        state: 'Wait',
        status: 'Running',
        input: {},
        output: {},
      });

      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      const result = await wait.run();

      expect(result).toBeNull();
      expect(mockRepo.delayOperation).toHaveBeenCalledWith(
        '123',
        '456',
        1672531210,
      );
      expect(mockLogger.trace).toHaveBeenCalledWith(
        { operationId: '123', afterUtc: 1672531210 },
        'Task entering waiting state.',
      );
    });

    it('should continue to next state if wait time is reached', async () => {
      // Set waitUntilUtc to a time in the past
      mockRepo.getOperation.mockResolvedValue({
        id: '123',
        execution: '456',
        state: 'Wait',
        status: 'Running',
        input: {},
        output: {},
        waitUntilUtc: 1672531100, // Time in the past
      });

      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        {
          id: '123',
          execution: '456',
          input: { data: 'test' },
          output: { data: 'test' },
        },
        mockRepo,
        mockLogger,
      );

      const result = await wait.run();

      expect(result).toEqual({
        nextOpId: 'mock-uuid',
        output: { data: 'test' },
        next: 'NextState',
      });

      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        '123',
        '456',
        'Succeeded',
        { data: 'test' },
      );

      expect(mockRepo.createOperation).toHaveBeenCalledWith(
        'mock-uuid',
        '456',
        'NextState',
        { data: 'test' },
      );

      expect(mockLogger.trace).toHaveBeenCalledWith(
        { operationId: '123' },
        'Task finished waiting.',
      );
    });

    it('should use existing waitUntilUtc if available', async () => {
      // Set waitUntilUtc to a time in the future
      mockRepo.getOperation.mockResolvedValue({
        id: '123',
        execution: '456',
        state: 'Wait',
        status: 'Running',
        input: {},
        output: {},
        waitUntilUtc: 1672531300, // Time in the future
      });

      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        { id: '123', execution: '456', input: {}, output: {} },
        mockRepo,
        mockLogger,
      );

      const result = await wait.run();

      expect(result).toBeNull();
      expect(mockRepo.delayOperation).toHaveBeenCalledWith(
        '123',
        '456',
        1672531300,
      );
    });

    it('should transition to next state after advancing time past wait period', async () => {
      // First call: operation is waiting
      mockRepo.getOperation.mockResolvedValueOnce({
        id: '123',
        execution: '456',
        state: 'Wait',
        status: 'Running',
        input: { data: 'test' },
        output: { data: 'test' },
        waitUntilUtc: null,
      });

      const wait = new Wait(
        { Type: 'Wait', Next: 'NextState', Seconds: 10 },
        {
          id: '123',
          execution: '456',
          input: { data: 'test' },
          output: { data: 'test' },
        },
        mockRepo,
        mockLogger,
      );

      // First run should delay the operation
      await wait.run();
      expect(mockRepo.delayOperation).toHaveBeenCalledWith(
        '123',
        '456',
        1672531210,
      );

      // Second call: operation wait time has passed
      mockRepo.getOperation.mockReset();
      mockRepo.getOperation.mockResolvedValueOnce({
        id: '123',
        execution: '456',
        state: 'Wait',
        status: 'Running',
        input: { data: 'test' },
        output: { data: 'test' },
        waitUntilUtc: 1672531210,
      });

      // Advance time past the wait period
      jest.setSystemTime(new Date('2023-01-01T00:00:15Z')); // 15 seconds later

      // Second run should proceed to next state
      const result = await wait.run();

      expect(result).toEqual({
        nextOpId: 'mock-uuid',
        output: { data: 'test' },
        next: 'NextState',
      });

      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        '123',
        '456',
        'Succeeded',
        { data: 'test' },
      );

      expect(mockRepo.createOperation).toHaveBeenCalledWith(
        'mock-uuid',
        '456',
        'NextState',
        { data: 'test' },
      );
    });
  });
});
