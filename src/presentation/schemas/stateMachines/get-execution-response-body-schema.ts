import { Static, Type } from '@sinclair/typebox';

export const GetExecutionResponseBodySchema = Type.Object({
  orid: Type.String(),
  status: Type.String(),
  operations: Type.Array(
    Type.Object({
      created: Type.String(),
      stateKey: Type.String(),
      status: Type.String(),
      input: Type.Unknown(),
      output: Type.Unknown(),
    }),
  ),
});

export type GetExecutionResponseBody = Static<
  typeof GetExecutionResponseBodySchema
>;
