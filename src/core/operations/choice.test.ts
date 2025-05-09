/* eslint-disable jest/expect-expect */
import { v4 } from 'uuid';
import { Choice } from './choice';
import { ChoiceState } from '../types/state-machine-definition';
import { mockRepo, mockLogger } from '../../test-utilities';

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('Choice', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  async function performSuccessTest(
    definition: ChoiceState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
    expectedNextKey: string,
  ) {
    // Arrange
    mockRepo.updateOperation.mockResolvedValue(undefined);
    mockRepo.createOperation.mockResolvedValue(undefined);
    (v4 as jest.Mock).mockReturnValue('nextOpId');

    // Act
    const choice = new Choice(definition, metadata, mockRepo, mockLogger);
    const result = await choice.run();
    expect(result).toStrictEqual({
      next: expectedNextKey,
      nextOpId: 'nextOpId',
      output: metadata.input,
    });
    expect(mockRepo.updateOperation).toHaveBeenCalledTimes(2);
    expect(mockRepo.updateOperation).toHaveBeenCalledWith(
      'operationId',
      'executionId',
      'Executing',
      metadata.input,
    );
    expect(mockRepo.updateOperation).toHaveBeenCalledWith(
      'operationId',
      'executionId',
      'Succeeded',
      metadata.input,
    );
    expect(mockRepo.createOperation).toHaveBeenCalledTimes(1);
    expect(mockRepo.createOperation).toHaveBeenCalledWith(
      'nextOpId',
      'executionId',
      expectedNextKey,
      metadata.input,
    );
  }

  async function performFailureTest(
    definition: ChoiceState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
  ) {
    mockRepo.updateOperation.mockResolvedValue(undefined);
    mockRepo.createOperation.mockResolvedValue(undefined);
    mockRepo.updateExecution.mockResolvedValue(undefined);
    (v4 as jest.Mock).mockReturnValue('nextOpId');

    // Act
    const choice = new Choice(definition, metadata, mockRepo, mockLogger);
    const result = await choice.run();
    expect(result).toStrictEqual({
      next: undefined,
      nextOpId: 'nextOpId',
      output: metadata.input,
    });
    expect(mockRepo.updateOperation).toHaveBeenCalledTimes(2);
    expect(mockRepo.updateOperation).toHaveBeenCalledWith(
      'operationId',
      'executionId',
      'Executing',
      metadata.input,
    );
    expect(mockRepo.updateOperation).toHaveBeenCalledWith(
      'operationId',
      'executionId',
      'Failed',
      undefined,
    );
    expect(mockRepo.createOperation).toHaveBeenCalledTimes(0);
    expect(mockRepo.updateExecution).toHaveBeenCalledTimes(1);
    expect(mockRepo.updateExecution).toHaveBeenCalledWith(
      'executionId',
      'Failed',
    );
  }

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
      new Choice(
        { Type: 'NotChoice' } as ChoiceState,
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
      new Choice(
        { Type: 'Choice' } as ChoiceState,
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
      new Choice(
        { Type: 'Choice' } as ChoiceState,
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

  it('should queue next operation and return payload when default set and no match found', async () => {
    // Arrange
    const metadata = {
      id: 'operationId',
      execution: 'executionId',
      input: { testMe: false },
      output: null,
    };
    const definition: ChoiceState = {
      Type: 'Choice',
      Default: 'Default',
      Choices: [
        {
          Variable: '$.testMe',
          BooleanEquals: true,
          Next: 'nextState',
        },
      ],
    };

    // Act & Assert
    return performSuccessTest(definition, metadata, 'Default');
  });

  it('should fail operation and execution when default not set and no match found', async () => {
    // Arrange
    const metadata = {
      id: 'operationId',
      execution: 'executionId',
      input: { testMe: false },
      output: null,
    };
    const definition: ChoiceState = {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.testMe',
          BooleanEquals: true,
          Next: 'nextState',
        },
      ],
    } as unknown as ChoiceState;

    // Act
    return performFailureTest(definition, metadata);
  });

  describe('should queue next operation and return payload when match found', () => {
    describe('And operator', () => {
      // TODO: implement choice And operator
    });

    describe('Not operator', () => {
      // TODO: implement choice Not operator
    });

    describe('Or operator', () => {
      //TODO: implement choice Or operator
    });

    describe('BooleanEquals operator', () => {
      describe('Successful match', () => {
        it('top level key', () => {
          // Arrange
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { testMe: true },
            output: null,
          };
          const definition: ChoiceState = {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.testMe',
                BooleanEquals: true,
                Next: 'nextState',
              },
            ],
            Default: 'Default',
          };

          // Act & Assert
          return performSuccessTest(definition, metadata, 'nextState');
        });

        it('nested key', () => {
          // Arrange
          const metadata = {
            id: 'operationId',
            execution: 'executionId',
            input: { nested: { testMe: true } },
            output: null,
          };
          const definition: ChoiceState = {
            Type: 'Choice',
            Choices: [
              {
                Variable: '$.nested.testMe',
                BooleanEquals: true,
                Next: 'nextState',
              },
            ],
            Default: 'Default',
          };

          // Act & Assert
          return performSuccessTest(definition, metadata, 'nextState');
        });
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: false },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              BooleanEquals: true,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };

        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('NumericEquals operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericEquals: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericEquals: 2,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('NumericGreaterThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericGreaterThan: 0,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericGreaterThan: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('NumericGreaterThanEquals operator', () => {
      it('Successful match greater than', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 2 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericGreaterThanEquals: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equals', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericGreaterThanEquals: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericGreaterThanEquals: 2,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('NumericLessThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericLessThan: 2,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericLessThan: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('NumericLessThanEquals operator', () => {
      it('Successful match less than', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericLessThanEquals: 2,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equals', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericLessThanEquals: 1,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 1 },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              NumericLessThanEquals: 0,
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('StringEquals operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'test' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringEquals: 'test',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'test' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringEquals: 'test1',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('StringGreaterThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'b' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringGreaterThan: 'a',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'a' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringGreaterThan: 'a',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('StringGreaterThanEquals operator', () => {
      it('Successful match greater than', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'b' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringGreaterThanEquals: 'a',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equals', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'a' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringGreaterThanEquals: 'a',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'a' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringGreaterThanEquals: 'b',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('StringLessThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'a' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringLessThan: 'b',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'b' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringLessThan: 'b',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('StringLessThanEquals operator', () => {
      it('Successful match less than', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'a' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringLessThanEquals: 'b',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equals', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'b' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringLessThanEquals: 'b',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: 'b' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              StringLessThanEquals: 'a',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('TimestampEquals operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampEquals: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampEquals: '2020-01-01T00:00:00.001Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('TimestampGreaterThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.001Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampGreaterThan: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampGreaterThan: '2020-01-01T00:00:00.001Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('TimestampGreaterThanEquals operator', () => {
      it('Successful match greater', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.001Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampGreaterThanEquals: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equal', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampGreaterThanEquals: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampGreaterThanEquals: '2020-01-01T00:00:00.001Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('TimestampLessThan operator', () => {
      it('Successful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampLessThan: '2020-01-01T00:00:00.001Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.001Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampLessThan: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });

    describe('TimestampLessThanEquals operator', () => {
      it('Successful match less than', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampLessThanEquals: '2020-01-01T00:00:00.001Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Successful match equal', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.000Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampLessThanEquals: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'nextState');
      });

      it('Unsuccessful match', () => {
        // Arrange
        const metadata = {
          id: 'operationId',
          execution: 'executionId',
          input: { testMe: '2020-01-01T00:00:00.001Z' },
          output: null,
        };
        const definition: ChoiceState = {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.testMe',
              TimestampLessThanEquals: '2020-01-01T00:00:00.000Z',
              Next: 'nextState',
            },
          ],
          Default: 'Default',
        };
        // Act & Assert
        return performSuccessTest(definition, metadata, 'Default');
      });
    });
  });
});
