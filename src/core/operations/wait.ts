import { StateMachineRepo } from '../interfaces/state-machine-repo';
import { BaseLogger } from 'pino';
import { WaitState } from '../types/state-machine-definition';
import { v4 } from 'uuid';

/**
 * JS uses milliseconds where epoch is defined in seconds
 */
const toEpoch = (ts: Date) => Math.floor(ts.getTime() / 1000);

export class Wait {
  readonly #seconds: number | undefined;
  readonly #timestamp: string | undefined;
  readonly #secondsPath: string | undefined;
  readonly #timestampPath: string | undefined;
  readonly #next: string;
  readonly #operationId: string;
  readonly #executionId: string;
  readonly #input: unknown;
  #output: unknown;
  readonly #repo: StateMachineRepo;
  readonly #logger: BaseLogger;

  constructor(
    definition: WaitState,
    metadata: {
      id: string;
      execution: string;
      input: unknown;
      output: unknown;
    },
    repo: StateMachineRepo,
    logger: BaseLogger,
  ) {
    if (!definition || definition.Type !== 'Wait') {
      throw new Error('Invalid definition');
    }
    if (!metadata) {
      throw new Error('Invalid metadata');
    }

    this.#seconds = definition.Seconds;
    this.#timestamp = definition.Timestamp;
    this.#secondsPath = definition.SecondsPath;
    this.#timestampPath = definition.TimestampPath;
    this.#next = definition.Next;
    this.#operationId = metadata.id;
    this.#executionId = metadata.execution;
    this.#input = metadata.input;
    this.#output = metadata.output;
    this.#repo = repo;
    this.#logger = logger;
  }

  static getValueFromPath(source: unknown, path: string): unknown {
    let tempSource = source;
    const parts = path.split('.');

    parts.forEach((p) => {
      if (p === '$' || !tempSource) return;
      tempSource = (tempSource as Record<string, unknown>)[p];
    });

    return tempSource;
  }

  computeWaitTimestamp() {
    let ts;
    if (this.#seconds) {
      ts = new Date();
      ts.setSeconds(ts.getSeconds() + Number(this.#seconds));
    }

    if (!ts && this.#secondsPath) {
      ts = new Date();
      ts.setSeconds(
        ts.getSeconds() +
          Number(Wait.getValueFromPath(this.#input, this.#secondsPath)),
      );
    }

    if (!ts && this.#timestamp) {
      ts = new Date(this.#timestamp);
    }

    if (!ts && this.#timestampPath) {
      ts = new Date(
        String(Wait.getValueFromPath(this.#input, this.#timestampPath)),
      );
    }

    if (!ts) throw new Error('Could not compute timestamp.');
    return toEpoch(ts);
  }

  async run() {
    this.#output = this.#input;

    const opDetails = await this.#repo.getOperation(
      this.#operationId,
      this.#executionId,
    );

    if (!opDetails) {
      throw new Error(
        `Operation not found: ${this.#executionId}-${this.#operationId}`,
      );
    }

    if (
      !opDetails.waitUntilUtc ||
      opDetails.waitUntilUtc > toEpoch(new Date())
    ) {
      const afterUtc = opDetails.waitUntilUtc || this.computeWaitTimestamp();
      this.#logger.trace(
        { operationId: this.#operationId, afterUtc },
        'Task entering waiting state.',
      );
      await this.#repo.delayOperation(
        this.#operationId,
        this.#executionId,
        afterUtc,
      );
      return null;
    }

    const nextOpId = v4();
    this.#logger.trace(
      { operationId: this.#operationId },
      'Task finished waiting.',
    );
    await this.#repo.updateOperation(
      this.#operationId,
      this.#executionId,
      'Succeeded',
      this.#output,
    );
    await this.#repo.createOperation(
      nextOpId,
      this.#executionId,
      this.#next,
      this.#output,
    );

    return {
      nextOpId,
      output: this.#output,
      next: this.#next,
    };
  }
}
