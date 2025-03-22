import { StateMachineRepo } from '../interfaces/state-machine-repo';
import { StateMachineDefinition } from '../types/state-machine-definition';
import { v4 } from 'uuid';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { NotFound } from '../errors/not-found';

export class Logic {
  #stateMachineRepo: StateMachineRepo;

  constructor({ stateMachineRepo }: { stateMachineRepo: StateMachineRepo }) {
    this.#stateMachineRepo = stateMachineRepo;
  }

  listStateMachines(accountId: string) {
    return this.#stateMachineRepo.listStateMachines(accountId);
  }

  createStateMachine(accountId: string, definition: StateMachineDefinition) {
    return this.#stateMachineRepo.createStateMachine(accountId, definition);
  }

  updateStateMachine(
    accountId: string,
    resourceId: string,
    definition: StateMachineDefinition,
  ) {
    return this.#stateMachineRepo.updateStateMachine(
      accountId,
      resourceId,
      definition,
    );
  }

  getStateMachine(accountId: string, resourceId: string) {
    return this.#stateMachineRepo.getStateMachine(accountId, resourceId);
  }

  removeStateMachine(accountId: string, resourceId: string) {
    return this.#stateMachineRepo.removeStateMachine(accountId, resourceId);
  }

  async invokeStateMachine(
    accountId: string,
    resourceId: string,
    input: unknown,
  ) {
    const executionId = v4();
    const operationId = v4();

    const stateMachine = await this.#stateMachineRepo.getStateMachine(
      accountId,
      resourceId,
    );

    if (!stateMachine) {
      throw new NotFound('State machine not found');
    }

    const activeVersion = stateMachine.versions.find(
      (v) => v.id === stateMachine.activeVersion,
    );
    await this.#stateMachineRepo.createExecution(
      executionId,
      stateMachine.id,
      stateMachine.activeVersion,
    );
    await this.#stateMachineRepo.createOperation(
      operationId,
      executionId,
      activeVersion!.definition.StartAt,
      input,
    );

    const queueClient = await MdsSdk.getQueueServiceClient();
    await queueClient.enqueueMessage(
      process.env.PENDING_QUEUE_NAME || 'PENDING_QUEUE_NAME NOT SET',
      {
        executionId,
        operationId,
        fromInvoke: true,
      },
    );

    return {
      executionId,
    };
  }

  getExecutionDetails(accountId: string, resourceId: string) {
    return this.#stateMachineRepo.getExecution(resourceId);
  }
}
