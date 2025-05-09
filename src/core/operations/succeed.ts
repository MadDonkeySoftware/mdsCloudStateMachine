import { StateMachineRepo } from '../interfaces/state-machine-repo';
import { BaseLogger } from 'pino';
import { SucceedState } from '../types/state-machine-definition';

export class Succeed {
  readonly #operationId: string;
  readonly #executionId: string;
  readonly #input: unknown;
  #output: unknown;
  readonly #repo: StateMachineRepo;
  readonly #logger: BaseLogger;

  constructor(
    definition: SucceedState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
    repo: StateMachineRepo,
    logger: BaseLogger,
  ) {
    if (!definition || definition.Type !== 'Succeed') {
      throw new Error('Invalid definition');
    }
    if (!metadata) {
      throw new Error('Invalid metadata');
    }

    this.#operationId = metadata.id;
    this.#executionId = metadata.execution;
    this.#input = metadata.input;
    this.#output = metadata.output;
    this.#repo = repo;
    this.#logger = logger;
  }

  async run() {
    this.#output = this.#input;

    await Promise.all([
      await this.#repo.updateOperation(
        this.#operationId,
        this.#executionId,
        'Succeeded',
        this.#output,
      ),
      await this.#repo.updateExecution(this.#executionId, 'Succeeded'),
    ]);

    return {
      output: this.#output,
    };
  }
}
