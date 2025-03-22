import { mockRepo, mockLogger } from '../../test-utilities';
import { Fail } from './fail';
import { FailState } from '../types/state-machine-definition';

describe('Fail', () => {
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
      new Fail(
        { Type: 'NotFail' } as FailState,
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
      new Fail(
        { Type: 'Fail' } as FailState,
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
      new Fail(
        { Type: 'Fail' } as FailState,
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
    const fail = new Fail({ Type: 'Fail' }, metadata, mockRepo, mockLogger);
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
      'Failed',
    );
  });
});
