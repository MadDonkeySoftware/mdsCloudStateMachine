import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ListStateMachinesResponseBodySchema } from '../../schemas';
import { v1 as oridV1 } from '@maddonkeysoftware/orid-node';
import { makeOrid } from '../../functions/make-orid';
import { validateToken } from '../../hooks/validate-token';
import { validateRequestOridParam } from '../../hooks/validate-request-orid-param';
import { validateCanAccessOridParam } from '../../hooks/validate-can-access-orid-param';
import {
  CreateStateMachineRequestBody,
  CreateStateMachineRequestBodySchema,
} from '../../schemas/stateMachines/create-state-machine-request-body-schema';
import { StateMachineDefinition } from '../../../core/types/state-machine-definition';
import { UpdateStateMachineRequestBody } from '../../schemas/stateMachines/update-state-machine-request-body-schema';
import {
  InvokeStateMachineRequestBody,
  InvokeStateMachineRequestBodySchema,
} from '../../schemas/stateMachines/invoke-state-machine-request-body-schema';
import { NotFound } from '../../../core/errors/not-found';
import { InvokeStateMachineResponseBodySchema } from '../../schemas/stateMachines/invoke-state-machine-response-body-schema';
import { GetExecutionResponseBodySchema } from '../../schemas/stateMachines/get-execution-response-body-schema';
import { UpdateStateMachineResponseBodySchema } from '../../schemas/stateMachines/update-state-machine-response-body-schema';

export function stateMachineController(
  app: FastifyInstance,
  opts: FastifyPluginOptions,
  done: () => void,
) {
  app.addHook('onRequest', validateToken);
  app.addHook('preHandler', validateRequestOridParam);
  app.addHook('preHandler', validateCanAccessOridParam);

  app.get(
    '/machines',
    {
      schema: {
        description: 'List state machines',
        tags: ['State Machines'],
        response: {
          200: ListStateMachinesResponseBodySchema,
        },
      },
    },
    async (request, reply) => {
      const { accountId } = request.parsedToken!.payload;
      const stateMachines =
        await request.services.logic.listStateMachines(accountId);
      return reply.status(200).send(
        stateMachines.map((sm) => ({
          ...sm,
          orid: makeOrid({
            resourceId: sm.id,
            accountId,
          }),
        })),
      );
    },
  );

  app.post<{
    Body: CreateStateMachineRequestBody;
  }>(
    '/machine',
    {
      schema: {
        description: 'Create a state machine',
        tags: ['State Machines'],
        body: CreateStateMachineRequestBodySchema,
        response: {
          201: {},
          409: {},
        },
      },
    },
    async (request, reply) => {
      const { accountId } = request.parsedToken!.payload;
      const stateMachine = await request.services.logic.createStateMachine(
        accountId,
        request.body as StateMachineDefinition,
      );
      return reply.status(200).send({
        ...stateMachine,
        orid: makeOrid({
          resourceId: stateMachine.id,
          accountId,
        }),
      });
    },
  );

  app.post<{
    Body: UpdateStateMachineRequestBody;
    Params: { orid: string };
  }>(
    '/machine/:orid',
    {
      schema: {
        description: 'Update a state machine',
        tags: ['State Machines'],
        response: {
          200: UpdateStateMachineResponseBodySchema, // TODO: Update response schema
          404: {},
        },
      },
    },
    async (request, reply) => {
      const parsedOrid = oridV1.parse(request.params.orid);
      // const { accountId } = request.parsedToken!.payload;
      const accountId = parsedOrid.custom3!;

      const stateMachine = await request.services.logic.updateStateMachine(
        accountId,
        parsedOrid.resourceId,
        request.body as StateMachineDefinition,
      );

      if (!stateMachine) {
        return reply.status(404).send();
      }

      return {
        ...stateMachine,
        orid: makeOrid({
          resourceId: stateMachine.id,
          accountId,
        }),
        definition: stateMachine.versions.find(
          (v) => v.id === stateMachine.activeVersion,
        )?.definition,
        versions: undefined,
      };
    },
  );

  app.delete<{
    Params: { orid: string };
  }>(
    '/machine/:orid',
    {
      schema: {
        description: 'Delete a state machine',
        tags: ['State Machines'],
        response: {
          204: {},
          404: {},
        },
      },
    },
    async (request, reply) => {
      const parsedOrid = oridV1.parse(request.params.orid);
      const { accountId } = request.parsedToken!.payload;

      const stateMachine = await request.services.logic.getStateMachine(
        accountId,
        parsedOrid.resourceId,
      );

      if (!stateMachine) {
        return reply.status(404).send();
      }

      await request.services.logic.removeStateMachine(
        accountId,
        parsedOrid.resourceId,
      );

      return reply.status(204).send();
    },
  );

  app.get<{
    Params: { orid: string };
  }>(
    '/machine/:orid',
    {
      schema: {
        description: 'Get a state machine',
        tags: ['State Machines'],
        response: {
          200: {},
          404: {},
        },
      },
    },
    async (request, reply) => {
      const parsedOrid = oridV1.parse(request.params.orid);
      const { accountId } = request.parsedToken!.payload;

      const stateMachine = await request.services.logic.getStateMachine(
        accountId,
        parsedOrid.resourceId,
      );

      if (!stateMachine) {
        return reply.status(404).send();
      }

      return JSON.stringify({
        name: stateMachine.name,
        orid: makeOrid({
          resourceId: stateMachine.id,
          accountId,
        }),
        definition: stateMachine.versions.find(
          (v) => v.id === stateMachine.activeVersion,
        )?.definition,
      });
    },
  );

  app.post<{
    Body: InvokeStateMachineRequestBody;
    Params: { orid: string };
  }>(
    '/machine/:orid/invoke',
    {
      schema: {
        description: 'Create a new execution fromm a state machine',
        tags: ['State Machines'],
        body: InvokeStateMachineRequestBodySchema,
        response: {
          200: InvokeStateMachineResponseBodySchema,
          403: {},
          404: {},
        },
      },
    },
    async (request, reply) => {
      const parsedOrid = oridV1.parse(request.params.orid);
      const { resourceId } = parsedOrid;
      const accountId = parsedOrid.custom3!;

      try {
        const { executionId } = await request.services.logic.invokeStateMachine(
          accountId,
          resourceId,
          request.body,
        );
        return reply.status(200).send({
          orid: makeOrid({
            resourceId,
            accountId,
            rider: executionId,
          }),
        });
      } catch (err) {
        if (err instanceof NotFound) {
          return reply.status(404).send();
        }
        throw err;
      }
    },
  );

  app.get<{
    Params: { orid: string; ['*']: string };
  }>(
    '/execution/:orid/*',
    {
      schema: {
        description: 'Get the details of an execution',
        tags: ['State Machines'],
        response: {
          200: GetExecutionResponseBodySchema,
          400: {},
          404: {},
        },
      },
    },
    async (request, reply) => {
      const parsedOrid = oridV1.parse(
        `${request.params.orid}/${request.params['*']}`,
      );
      const { resourceId, resourceRider, custom3: accountId } = parsedOrid;

      if (!resourceRider) {
        return reply.status(400).send();
      }

      const execution = await request.services.logic.getExecutionDetails(
        accountId as string,
        resourceRider,
      );

      if (!execution) {
        return reply.status(404).send();
      }

      return reply.status(200).send({
        orid: makeOrid({
          resourceId,
          accountId: accountId as string,
          rider: execution.id,
        }),
        status: execution.status,
        operations: execution.operations,
      });
    },
  );

  done();
}
