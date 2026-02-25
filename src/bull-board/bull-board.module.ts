import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { FastifyAdapter } from '@bull-board/fastify';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: FastifyAdapter,
    }),
    // BullBoardModule.forFeature({
    //   name: 'http-requests',
    //   adapter: BullMQAdapter,
    // }),
  ],
})
export class BullBoardConfigModule {}
