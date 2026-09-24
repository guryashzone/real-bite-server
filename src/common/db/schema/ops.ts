import { bigserial, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Every admin and moderation action, plus the security events called out by name elsewhere in the
 * spec — e.g. a refresh-token replay (docs/11 §2.1: `auth.refresh_replay`, one row per replay,
 * watched by an alarm on any spike). `actor_user_id` is nullable so a system-initiated action
 * (a job, an unauthenticated security event) can still be recorded. Legal record: never pruned.
 */
export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: jsonb('metadata'),
  ipHash: text('ip_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
