import { Static, Type } from '@sinclair/typebox';

export const InvokeStateMachineRequestBodySchema = Type.Unknown();

export type InvokeStateMachineRequestBody = Static<
  typeof InvokeStateMachineRequestBodySchema
>;
