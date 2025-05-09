import { StateMachineDefinition } from '../types/state-machine-definition';

export type StateMachineData = {
  id: string;
  accountId: string;
  name: string;
  isDeleted: boolean;
  activeVersion: string;
  versions: {
    id: string;
    definition: StateMachineDefinition;
  }[];
};

export type Status =
  | 'Executing'
  | 'Failed'
  | 'Pending'
  | 'Succeeded'
  | 'Waiting';

export type OperationData = {
  id: string;
  created: string;
  stateKey: string;
  status: Status;
  input: unknown;
  output: unknown | null;
  waitUntilUtc?: number; // EPOCH seconds
};

export type ExecutionData = {
  id: string;
  created: string;
  status: Status;
  stateMachine: string; // StateMachineId
  version: string; // VersionId
  operations: OperationData[]; // TODO: define the type
};

export interface StateMachineRepo {
  createStateMachine(
    accountId: string,
    definition: StateMachineDefinition,
  ): Promise<StateMachineData>;

  updateStateMachine(
    accountId: string,
    resourceId: string,
    definition: StateMachineDefinition,
  ): Promise<StateMachineData | null>;

  getStateMachine(
    accountId: string,
    resourceId: string,
  ): Promise<StateMachineData | null>;

  removeStateMachine(accountId: string, resourceId: string): unknown;

  listStateMachines(accountId: string): Promise<StateMachineData[]>;

  createExecution(
    id: string,
    stateMachineId: string,
    versionId: string,
  ): Promise<void>;

  updateExecution(id: string, status: Status): Promise<void>;

  getExecution(id: string): Promise<ExecutionData | null>;

  getStateMachineDefinitionForExecution(
    id: string,
  ): Promise<StateMachineDefinition | null>;

  createOperation(
    id: string,
    executionId: string,
    stateKey: string,
    input: unknown,
  ): Promise<void>;

  updateOperation(
    id: string,
    executionId: string,
    status: Status,
    output: unknown,
  ): Promise<void>;

  delayOperation(
    id: string,
    executionId: string,
    waitUntilUtc: number,
  ): Promise<void>;

  getOperation(
    id: string,
    executionId: string,
  ): Promise<(OperationData & { execution: string }) | null>;

  getDelayedOperations(
    waitUntilUtc: number,
  ): Promise<{ execution: string; id: string }[]>;
}
