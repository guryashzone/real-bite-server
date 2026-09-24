import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { auditLogs } from '../common/db/schema/index.js';

export interface AuditLogEntry {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  ipHash?: string | null;
}

/** Every admin, moderation and named security event (docs/02 §4). Legal record: never deleted. */
@Injectable()
export class AuditLogsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(entry: AuditLogEntry, tx: Database = this.db): Promise<void> {
    await tx.insert(auditLogs).values({
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
      ipHash: entry.ipHash ?? null,
    });
  }
}
