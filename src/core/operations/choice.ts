import { v4 } from 'uuid';

import { ChoiceState } from '../types/state-machine-definition';
import { StateMachineRepo } from '../interfaces/state-machine-repo';
import { BaseLogger } from 'pino';

function getValueFromPath(source: unknown, path: string) {
  // TODO: Make the types better here
  let tempSource = source as any;
  const parts = path.split('.');

  parts.forEach((p) => {
    if (p === '$' || !tempSource) return;
    tempSource = tempSource[p] as any;
  });

  return tempSource;
}

type Operations =
  | 'And'
  | 'BooleanEquals'
  | 'Not'
  | 'NumericEquals'
  | 'NumericGreaterThan'
  | 'NumericGreaterThanEquals'
  | 'NumericLessThan'
  | 'NumericLessThanEquals'
  | 'Or'
  | 'StringEquals'
  | 'StringGreaterThan'
  | 'StringGreaterThanEquals'
  | 'StringLessThan'
  | 'StringLessThanEquals'
  | 'TimestampEquals'
  | 'TimestampGreaterThan'
  | 'TimestampGreaterThanEquals'
  | 'TimestampLessThan'
  | 'TimestampLessThanEquals';

function performTest(
  operation: Operations,
  choice: ChoiceState['Choices'][0],
  input: unknown,
) {
  switch (operation) {
    case 'BooleanEquals':
    case 'StringEquals':
    case 'NumericEquals':
    case 'TimestampEquals':
      return getValueFromPath(input, choice.Variable) === choice[operation];

    case 'NumericGreaterThan':
    case 'StringGreaterThan':
    case 'TimestampGreaterThan':
      // @ts-expect-error Porting code from node and will revisit once time permits
      return getValueFromPath(input, choice.Variable) > choice[operation];

    case 'NumericGreaterThanEquals':
    case 'StringGreaterThanEquals':
    case 'TimestampGreaterThanEquals':
      // @ts-expect-error Porting code from node and will revisit once time permits
      return getValueFromPath(input, choice.Variable) >= choice[operation];

    case 'NumericLessThan':
    case 'StringLessThan':
    case 'TimestampLessThan':
      // @ts-expect-error Porting code from node and will revisit once time permits
      return getValueFromPath(input, choice.Variable) < choice[operation];

    case 'NumericLessThanEquals':
    case 'StringLessThanEquals':
    case 'TimestampLessThanEquals':
      // @ts-expect-error Porting code from node and will revisit once time permits
      return getValueFromPath(input, choice.Variable) <= choice[operation];

    default:
      throw Error(`Condition ${operation} not yet implemented.`);
  }
}

export class Choice {
  get output() {
    // TODO: If not used, remove getter
    return this.#output;
  }

  readonly #repo: StateMachineRepo;
  readonly #logger: BaseLogger;
  readonly #choices: ChoiceState['Choices'];
  readonly #default: ChoiceState['Default'];
  readonly #operationId: string;
  readonly #executionId: string;
  readonly #input: unknown;
  #output: unknown;

  constructor(
    definition: ChoiceState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
    repo: StateMachineRepo,
    logger: BaseLogger,
  ) {
    if (!definition || definition.Type !== 'Choice') {
      throw new Error('Invalid definition');
    }
    if (!metadata) {
      throw new Error('Invalid metadata');
    }

    this.#choices = definition.Choices;
    this.#default = definition.Default;
    this.#operationId = metadata.id;
    this.#executionId = metadata.execution;
    this.#input = metadata.input;
    this.#output = metadata.output;
    this.#repo = repo;
    this.#logger = logger;
  }

  #processChoice(): string {
    let next = null;
    const checks = [
      'And',
      'BooleanEquals',
      'Not',
      'NumericEquals',
      'NumericGreaterThan',
      'NumericGreaterThanEquals',
      'NumericLessThan',
      'NumericLessThanEquals',
      'Or',
      'StringEquals',
      'StringGreaterThan',
      'StringGreaterThanEquals',
      'StringLessThan',
      'StringLessThanEquals',
      'TimestampEquals',
      'TimestampGreaterThan',
      'TimestampGreaterThanEquals',
      'TimestampLessThan',
      'TimestampLessThanEquals',
    ] satisfies Operations[];

    for (let i = 0; i < this.#choices.length; i += 1) {
      const choice = this.#choices[i];
      if (next) break;
      for (let j = 0; j < checks.length; j += 1) {
        const check = checks[j];
        if (
          Object.prototype.hasOwnProperty.call(choice, check) &&
          performTest(check, choice, this.#input)
        ) {
          next = choice.Next;
          break;
        }
      }
    }

    return next || this.#default;
  }

  async run() {
    this.#output = await this.#input;
    const nextOpId = v4();

    try {
      await this.#repo.updateOperation(
        this.#operationId,
        this.#executionId,
        'Executing',
        this.#output,
      );

      const nextStateKey = this.#processChoice();
      if (nextStateKey) {
        await Promise.all([
          this.#repo.createOperation(
            nextOpId,
            this.#executionId,
            nextStateKey,
            this.#output,
          ),
          this.#repo.updateOperation(
            this.#operationId,
            this.#executionId,
            'Succeeded',
            this.#output,
          ),
        ]);
      } else {
        await Promise.all([
          this.#repo.updateOperation(
            this.#operationId,
            this.#executionId,
            'Failed',
            undefined,
          ),
          this.#repo.updateExecution(this.#executionId, 'Failed'),
        ]);
      }

      return {
        nextOpId,
        output: this.#output,
        next: nextStateKey,
      };
    } catch (err) {
      this.#logger.warn(
        { executionId: this.#executionId, operationId: this.#operationId, err },
        'Failed processing choice step.',
      );
      await Promise.all([
        this.#repo.updateOperation(
          this.#operationId,
          this.#executionId,
          'Failed',
          undefined,
        ),
        this.#repo.updateExecution(this.#executionId, 'Failed'),
      ]);
    }
  }
}
