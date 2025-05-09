import { Choice } from './choice';
import { Fail } from './fail';
import { Succeed } from './succeed';
import { Task } from './task';
import { Wait } from './wait';
import { getOperation } from './index';
import { StateMachineDefinition } from '../types/state-machine-definition';
import { mockLogger, mockRepo } from '../../test-utilities';

describe('Operations', () => {
  describe('getOperation', () => {
    const testDefinition: StateMachineDefinition = {
      Name: 'TestOperation',
      StartAt: 'Task',
      States: {
        Task: {
          Type: 'Task',
          Resource:
            'orid:1:mdsCloud:::1001:sf:7612017c-8ce5-406c-941b-8e90529ffb5f',
          Next: 'Wait',
        },
        Wait: {
          Type: 'Wait',
          Seconds: 1,
          Next: 'Choice',
        },
        Choice: {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.shouldFail',
              BooleanEquals: true,
              Next: 'Fail',
            },
          ],
          Default: 'Succeed',
        },
        Fail: {
          Type: 'Fail',
        },
        Succeed: {
          Type: 'Succeed',
        },
      },
    };
    const baseMetadata = {
      id: 'operationId',
      execution: 'executionId',
      input: null,
      output: null,
    };

    it.each([
      ['Choice', Choice],
      ['Fail', Fail],
      ['Succeed', Succeed],
      ['Task', Task],
      ['Wait', Wait],
      ['Unknown', null],
    ])('should return %s', (type, expected) => {
      // Arrange
      const metadata = {
        ...baseMetadata,
        stateKey: type,
      };

      // Act
      const operation = getOperation(
        testDefinition,
        metadata,
        mockLogger,
        mockRepo,
      );

      // Assert
      if (type === 'Unknown') {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(operation).toBeNull();
      } else {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(operation).toBeInstanceOf(expected);
      }
    });
  });
});
