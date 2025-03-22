import { StateMachineRepo } from '../interfaces/state-machine-repo';
import { BaseLogger } from 'pino';
import { TaskState, CatchDefinition } from '../types/state-machine-definition';
import { v4 } from 'uuid';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';

export class Task {
  readonly #resource: string;
  readonly #next: string;
  readonly #catch: CatchDefinition[];
  readonly #operationId: string;
  readonly #executionId: string;
  readonly #input: unknown;
  #output: unknown;
  readonly #repo: StateMachineRepo;
  readonly #logger: BaseLogger;

  constructor(
    definition: TaskState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
    repo: StateMachineRepo,
    logger: BaseLogger,
  ) {
    if (!definition || definition.Type !== 'Task') {
      throw new Error(`Attempted to use ${definition.Type} type for "Task".`);
    }
    if (!metadata) {
      throw new Error('Invalid metadata');
    }

    this.#resource = definition.Resource;
    this.#next = definition.Next;
    this.#catch = definition.Catch;
    this.#operationId = metadata.id;
    this.#executionId = metadata.execution;
    this.#input = metadata.input;
    this.#output = metadata.output;
    this.#repo = repo;
    this.#logger = logger;
  }

  async handleInvokeResponse(result: unknown, err: unknown) {
    const nextOpId = v4();
    if (err) {
      if (this.#catch) {
        for (let i = 0; i < this.#catch.length; i += 1) {
          const def = this.#catch[i];
          const errs = def.ErrorEquals;
          const errNext = def.Next;

          if (!errs || !errs.length) {
            continue;
          }

          if (errs.length === 1 && errs[0] === 'States.ALL') {
            this.#logger.trace({ err }, 'Function invoke failed.');

            await Promise.all([
              this.#repo.updateOperation(
                this.#operationId,
                this.#executionId,
                'Failed',
                this.#input,
              ),
              this.#repo.createOperation(
                nextOpId,
                this.#executionId,
                errNext,
                this.#input,
              ),
            ]);

            return {
              nextOpId,
              output: this.#input,
              next: errNext,
            };
          }
        }
      }

      await Promise.all([
        this.#repo.updateOperation(
          this.#operationId,
          this.#executionId,
          'Failed',
          this.#input,
        ),
        this.#repo.updateExecution(this.#executionId, 'Failed'),
      ]);
      throw err;
    }

    const output = result;
    await Promise.all([
      this.#repo.updateOperation(
        this.#operationId,
        this.#executionId,
        'Succeeded',
        output,
      ),
      this.#repo.createOperation(
        nextOpId,
        this.#executionId,
        this.#next,
        output,
      ),
    ]);
    return {
      nextOpId,
      output,
      next: this.#next,
    };
  }

  async invokeFunction(resource: string, body: unknown) {
    const client = await MdsSdk.getServerlessFunctionsClient();
    // TODO: Retry logic.ts
    return client.invokeFunction(resource, body);
  }

  async run() {
    let body = this.#input;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
    }

    this.#logger.trace({ body }, 'Invoking remote function.');

    try {
      await this.#repo.updateOperation(
        this.#operationId,
        this.#executionId,
        'Executing',
        this.#output,
      );
      const result = await this.invokeFunction(this.#resource, body);
      return this.handleInvokeResponse(result, undefined);
    } catch (err) {
      return this.handleInvokeResponse(undefined, err);
    }
  }
}
