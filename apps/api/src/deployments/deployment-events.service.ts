import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { DeploymentStatus } from '@opendeploy/shared';

export type DeploymentStreamEvent =
  | { type: 'status'; deploymentId: string; status: DeploymentStatus; at: string }
  | { type: 'log'; deploymentId: string; seq: number; level: string; message: string; at: string };

@Injectable()
export class DeploymentEventsService {
  private readonly subject = new Subject<DeploymentStreamEvent>();

  stream() {
    return this.subject.asObservable();
  }

  emit(event: DeploymentStreamEvent): void {
    this.subject.next(event);
  }
}
