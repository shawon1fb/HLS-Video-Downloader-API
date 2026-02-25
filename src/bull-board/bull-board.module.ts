import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { FastifyAdapter } from '@bull-board/fastify';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: FastifyAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'downloads',
      adapter: BullMQAdapter,
    }),
  ],
})
export class BullBoardConfigModule {}
