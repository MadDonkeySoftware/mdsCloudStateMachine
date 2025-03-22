import { Static, Type } from '@sinclair/typebox';

export const CreateStateMachineRequestBodySchema = Type.Object({
  Name: Type.String(),
  StartAt: Type.String(),
  States: Type.Object({}),
});

export type CreateStateMachineRequestBody = Static<
  typeof CreateStateMachineRequestBodySchema
>;
