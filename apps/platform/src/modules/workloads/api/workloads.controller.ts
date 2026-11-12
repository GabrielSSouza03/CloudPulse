import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import type { Static } from '@sinclair/typebox';
import { decodeCursor, encodeCursor } from '../../../platform/http/cursor.js';
import { TypeBoxPipe } from '../../../platform/validation/typebox.pipe.js';
import { type Actor, CurrentActor } from '../../tenancy/index.js';
import { WorkloadService, type WorkloadView } from '../application/workload.service.js';
import { ListWorkloadsQuery, RegisterWorkloadBody } from './dto.js';

@Controller('v1/workloads')
export class WorkloadsController {
  constructor(private readonly workloads: WorkloadService) {}

  @Post()
  register(
    @CurrentActor() actor: Actor,
    @Body(new TypeBoxPipe(RegisterWorkloadBody)) body: Static<typeof RegisterWorkloadBody>,
  ): Promise<WorkloadView> {
    return this.workloads.register(actor, body);
  }

  @Get()
  async list(
    @CurrentActor() actor: Actor,
    @Query(new TypeBoxPipe(ListWorkloadsQuery, { coerce: true }))
    query: Static<typeof ListWorkloadsQuery>,
  ): Promise<{ items: WorkloadView[]; nextCursor: string | null }> {
    const page = await this.workloads.page(actor, {
      limit: query.limit,
      ...(query.cursor ? { afterId: decodeCursor(query.cursor) } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
    });
    const last = page.items.at(-1);
    return { items: page.items, nextCursor: page.hasMore && last ? encodeCursor(last.id) : null };
  }
}
