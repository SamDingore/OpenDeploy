import type { Prisma } from '../../../../generated/prisma/client';
import type { StageProgress, StreamLogLine } from './deployment-stream.types';

const LOG_LEVELS = new Set(['info', 'warn', 'error', 'success']);

function isStreamLogLine(value: unknown): value is StreamLogLine {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.timestamp === 'string' &&
    typeof o.message === 'string' &&
    typeof o.level === 'string' &&
    LOG_LEVELS.has(o.level)
  );
}

function isStageProgress(value: unknown): value is StageProgress {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.label === 'string' &&
    typeof o.status === 'string' &&
    typeof o.updatedAt === 'string'
  );
}

/** Parses persisted JSON from DB into log lines; invalid entries are dropped. */
export function parseStoredStreamLogs(value: Prisma.JsonValue): StreamLogLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isStreamLogLine);
}

/** Parses persisted JSON from DB into stage rows; invalid entries are dropped. */
export function parseStoredStreamStages(value: Prisma.JsonValue): StageProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isStageProgress);
}
