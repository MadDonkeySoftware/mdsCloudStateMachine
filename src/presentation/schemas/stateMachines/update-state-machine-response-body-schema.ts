import { Static, Type } from '@sinclair/typebox';

export const UpdateStateMachineResponseBodySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  isDeleted: Type.Boolean(),
  activeVersion: Type.String(),
  orid: Type.String(),
  definition: Type.Object({
    Name: Type.String(),
    StartAt: Type.String(),
    States: Type.Record(Type.String(), Type.Any()),
  }),
});

export type UpdateStateMachineResponseBody = Static<
  typeof UpdateStateMachineResponseBodySchema
>;

/*
id: string
accountId: string
name: string
isDeleted: boolean
activeVersion: string
versions: {
  id: string
  definition: StateMachineDefinition
}[]
orid: string
definition: StateMachineDefinition
versions: StateMachineDefinition[]
 */
