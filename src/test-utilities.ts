import {
  QueueServiceClient,
  ServerlessFunctionsClient,
} from '@maddonkeysoftware/mds-cloud-sdk-node/clients';
import { BaseLogger } from 'pino';
import { StateMachineRepo } from './core/interfaces/state-machine-repo';

export const mockQueueClient = {
  createQueue: jest.fn(),
  deleteMessage: jest.fn(),
  deleteQueue: jest.fn(),
  enqueueMessage: jest.fn(),
  fetchMessage: jest.fn(),
  getQueueDetails: jest.fn(),
  getQueueLength: jest.fn(),
  listQueues: jest.fn(),
  updateQueue: jest.fn(),

  // private fields and getters
  _serviceUrl: 'http://localhost:8888',
  authManager: null,
  get serviceUrl() {
    /* istanbul ignore next */
    return 'http://localhost:8888';
  },

  // @ts-expect-error - Cannot mock private fields
} satisfies QueueServiceClient;

export const mockFunctionsClient = {
  invokeFunction: jest.fn(),
  createFunction: jest.fn(),
  deleteFunction: jest.fn(),
  getFunctionDetails: jest.fn(),
  listFunctions: jest.fn(),
  updateFunctionCode: jest.fn(),

  // @ts-expect-error - Cannot mock private fields
} satisfies ServerlessFunctionsClient;

export const mockRepo = {
  updateOperation: jest.fn(),
  createOperation: jest.fn(),
  getOperation: jest.fn(),
  createExecution: jest.fn(),
  createStateMachine: jest.fn(),
  updateExecution: jest.fn(),
  updateStateMachine: jest.fn(),
  getStateMachine: jest.fn(),
  getStateMachineDefinitionForExecution: jest.fn(),
  removeStateMachine: jest.fn(),
  listStateMachines: jest.fn(),
  getExecution: jest.fn(),
  delayOperation: jest.fn(),
  getDelayedOperations: jest.fn().mockResolvedValue([]),
} satisfies StateMachineRepo;

export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  level: 'debug',
  silent: jest.fn(),
} satisfies BaseLogger;
