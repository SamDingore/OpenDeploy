import type { StageProgress } from './deployment-stream.types';
import { nowIso } from './time.util';

export function createInitialStages(): StageProgress[] {
  const emittedAt = nowIso();
  return [
    { id: 'queued', label: 'Queued', status: 'running', updatedAt: emittedAt },
    {
      id: 'initializing',
      label: 'Initialize Worker',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'installing',
      label: 'Install Dependencies',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'building',
      label: 'Build Project',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'packaging',
      label: 'Package Artifacts',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'healthcheck',
      label: 'Run Health Checks',
      status: 'pending',
      updatedAt: emittedAt,
    },
    {
      id: 'ready',
      label: 'Deployment Ready',
      status: 'pending',
      updatedAt: emittedAt,
    },
  ];
}
