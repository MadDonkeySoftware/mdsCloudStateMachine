import { FastifyInstance } from 'fastify';
import { stateMachineController } from '../../controllers/v1';

export async function v1Router(app: FastifyInstance) {
  await app.register(stateMachineController, { prefix: '/' });
}
