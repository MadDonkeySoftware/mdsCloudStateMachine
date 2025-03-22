import {
  ChoiceState,
  StateMachineDefinition,
  TaskState,
  WaitState,
} from '../types/state-machine-definition';
import { BaseLogger } from 'pino';
import { Task } from './task';
import { Succeed } from './succeed';
import { Fail } from './fail';
import { Choice } from './choice';
import { Wait } from './wait';
import { StateMachineRepo } from '../interfaces/state-machine-repo';

type Metadata = {
  id: string;
  execution: string;
  input: unknown;
  output: unknown;
  stateKey: string;
};

// TODO: Move into worker
export function getOperation(
  definition: StateMachineDefinition,
  metadata: Metadata,
  logger: BaseLogger,
  repo: StateMachineRepo,
) {
  if (!definition) {
    logger.error(
      'Definition appears falsy. Insufficient information to find operation.',
    );
  }
  if (!metadata) {
    logger.error(
      'Metadata appears falsy. Insufficient information to find operation.',
    );
  }

  const currentState = definition.States[metadata.stateKey];

  if (!currentState) {
    const availableStates = Object.keys(definition.States).join(',');
    logger.error(
      {
        stateKey: metadata.stateKey,
        availableStates,
      },
      'Current state appears falsy',
    );
  }

  switch (currentState.Type) {
    case 'Task':
      return new Task(currentState as TaskState, metadata, repo, logger);
    case 'Succeed':
      return new Succeed(currentState, metadata, repo, logger);
    case 'Fail':
      return new Fail(currentState, metadata, repo, logger);
    case 'Choice':
      return new Choice(currentState as ChoiceState, metadata, repo, logger);
    case 'Wait':
      return new Wait(currentState as WaitState, metadata, repo, logger);
    default:
      break;
  }
}
