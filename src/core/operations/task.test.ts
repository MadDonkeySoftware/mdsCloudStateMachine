import { v4 } from 'uuid';
import { Task } from './task';
import { TaskState } from '../types/state-machine-definition';
import { mockRepo, mockLogger } from '../../test-utilities';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

const mockInvokeFunction = jest.fn();

jest.mock('@maddonkeysoftware/mds-cloud-sdk-node', () => ({
  MdsSdk: {
    getServerlessFunctionsClient: jest.fn().mockImplementation(() =>
      Promise.resolve({
        invokeFunction: mockInvokeFunction,
      }),
    ),
  },
}));

describe('Task', () => {
  const baseMetadata = {
    id: 'operationId',
    execution: 'executionId',
    input: { someData: 'value' },
    output: null,
  };
  const baseDefinition: TaskState = {
    Type: 'Task',
    Resource: 'some-resource-uri',
    Next: 'NextState',
    Catch: [
      {
        Next: 'CatchState',
      },
    ],
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw exception when definition type is not task', () => {
    // Arrange
    const metadata = {
      id: 'operationId',
      execution: 'executionId',
      input: null,
      output: null,
    };
    const definition = { Type: 'NotTask' } as TaskState;
    // Act & Assert
    expect(() => {
      new Task(definition, metadata, mockRepo, mockLogger);
    }).toThrow('Attempted to use NotTask type for "Task".');
  });

  it('should throw exception when definition omits catch and invoke throws exception.', async () => {
    // Arrange
    const definition = {
      ...baseDefinition,
      Catch: undefined,
    } as unknown as TaskState;

    const mockInvokeError = new Error('Failed to invoke resource');
    mockInvokeFunction.mockRejectedValue(mockInvokeError);

    const task = new Task(definition, baseMetadata, mockRepo, mockLogger);

    // Act & Assert
    await expect(task.run()).rejects.toThrow(mockInvokeError);
    expect(mockInvokeFunction).toHaveBeenCalledWith(
      'some-resource-uri',
      JSON.stringify(baseMetadata.input),
    );
  });

  describe('should succeed operation and create next operation', () => {
    const inputMapper = (value: unknown) => {
      if (value === null) {
        // NOTE: typeof null returns 'object'
        return null;
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    };

    it.each([
      // label, input
      ['undefined', undefined],
      ['null', null],
      ['string', 'input'],
      ['object', { someData: 'value' }],
    ])('when input is %p', async (_, input) => {
      // Arrange
      const metadata = {
        ...baseMetadata,
        input,
      };
      mockInvokeFunction.mockResolvedValue({ userResult: 'stuff' });
      (v4 as jest.Mock).mockReturnValue('nextOpId');
      const task = new Task(baseDefinition, metadata, mockRepo, mockLogger);

      // Act
      const result = await task.run();

      // Assert
      expect(mockInvokeFunction).toHaveBeenCalledTimes(1);
      expect(mockInvokeFunction).toHaveBeenCalledWith(
        baseDefinition.Resource,
        inputMapper(input),
      );
      expect(mockRepo.updateOperation).toHaveBeenCalledTimes(2);
      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        baseMetadata.id,
        baseMetadata.execution,
        'Executing',
        null,
      );
      expect(mockRepo.updateOperation).toHaveBeenCalledWith(
        baseMetadata.id,
        baseMetadata.execution,
        'Succeeded',
        {
          userResult: 'stuff',
        },
      );
      expect(mockRepo.createOperation).toHaveBeenCalledTimes(1);
      expect(mockRepo.createOperation).toHaveBeenCalledWith(
        'nextOpId',
        baseMetadata.execution,
        'NextState',
        {
          userResult: 'stuff',
        },
      );
      expect(mockRepo.updateExecution).toHaveBeenCalledTimes(0);
      expect(result).toStrictEqual({
        next: baseDefinition.Next,
        nextOpId: 'nextOpId',
        output: {
          userResult: 'stuff',
        },
      });
    });
  });
});
