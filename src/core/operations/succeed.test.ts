import { Succeed } from './succeed';
import { SucceedState } from '../types/state-machine-definition';
import { mockLogger, mockRepo } from '../../test-utilities';

describe('Succeed', () => {
  it('should throw exception when definition type is not choice', () => {
    // Arrange
    const metadata = {
      id: 'operationId',
      execution: 'executionId',
      input: null,
      output: null,
    };

    // Act & Assert
    expect(() => {
      new Succeed(
        { Type: 'NotSucceed' } as SucceedState,
        metadata,
        mockRepo,
        mockLogger,
      );
    }).toThrow('Invalid definition');
  });

  it('should throw exception when metadata is null', () => {
    // Arrange
    const metadata = null;

    // Act & Assert
    expect(() => {
      new Succeed(
        { Type: 'Succeed' } as SucceedState,
        metadata as unknown as {
          id: string;
          execution: string;
          input: unknown;
          output: unknown;
        },
        mockRepo,
        mockLogger,
      );
    }).toThrow('Invalid metadata');
  });

  it('should throw exception when metadata is undefined', () => {
    // Arrange
    const metadata = undefined;

    // Act & Assert
    expect(() => {
      new Succeed(
        { Type: 'Succeed' } as SucceedState,
        metadata as unknown as {
          id: string;
          execution: string;
          input: unknown;
          output: unknown;
        },
        mockRepo,
        mockLogger,
      );
    }).toThrow('Invalid metadata');
  });

  it('should succeed operation and fail execution', async () => {
    // Arrange
    const metadata = {
      id: 'operationId',
      execution: 'executionId',
      input: null,
      output: null,
    };
    mockRepo.updateOperation.mockResolvedValue(undefined);
    mockRepo.updateExecution.mockResolvedValue(undefined);

    // Act
    const fail = new Succeed(
      { Type: 'Succeed' },
      metadata,
      mockRepo,
      mockLogger,
    );
    await fail.run();

    // Assert
    expect(mockRepo.updateOperation).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateOperation).toHaveBeenCalledWith(
      'operationId',
      'executionId',
      'Succeeded',
      null,
    );
    expect(mockRepo.updateExecution).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateExecution).toHaveBeenCalledWith(
      'executionId',
      'Succeeded',
    );
  });
});
