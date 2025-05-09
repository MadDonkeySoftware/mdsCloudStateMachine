import { Static, Type } from '@sinclair/typebox';

export const ListStateMachinesResponseBodySchema = Type.Array(
  Type.Object({
    name: Type.String(),
    id: Type.String(),
    orid: Type.String(),
    activeVersion: Type.Optional(Type.String()),
    isDeleted: Type.Optional(Type.Boolean()),
    // TODO: Remove snake case items once it has been verified they are no longer used
    active_version: Type.Optional(Type.String()),
    is_deleted: Type.Optional(Type.Boolean()),
  }),
);

export type ListFunctionsResponseBody = Static<
  typeof ListStateMachinesResponseBodySchema
>;
