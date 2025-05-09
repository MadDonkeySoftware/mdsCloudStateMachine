import { Static, Type } from '@sinclair/typebox';

export const InvokeStateMachineResponseBodySchema = Type.Object({
  orid: Type.String(),
});

export type InvokeStateMachineResponseBody = Static<
  typeof InvokeStateMachineResponseBodySchema
>;
