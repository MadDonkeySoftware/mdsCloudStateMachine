import { Static, Type } from '@sinclair/typebox';

export const UpdateStateMachineRequestBodySchema = Type.Object({
  Name: Type.String(),
  StartAt: Type.String(),
  States: Type.Object({}),
});

export type UpdateStateMachineRequestBody = Static<
  typeof UpdateStateMachineRequestBodySchema
>;
