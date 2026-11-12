import { Module } from '@nestjs/common';
import { WorkloadService } from './application/workload.service.js';
import { WorkloadsController } from './api/workloads.controller.js';

@Module({
  controllers: [WorkloadsController],
  providers: [WorkloadService],
})
export class WorkloadsModule {}
