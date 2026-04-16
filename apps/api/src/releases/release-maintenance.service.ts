import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ReleasesService } from './releases.service';

@Injectable()
export class ReleaseMaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(ReleaseMaintenanceService.name);

  constructor(private readonly releases: ReleasesService) {}

  onModuleInit(): void {
    setInterval(() => {
      void this.releases
        .purgeStalePreviews()
        .then((n) => {
          if (n > 0) this.logger.log({ purged: n }, 'preview_ttl_cleanup');
        })
        .catch((e) => this.logger.error(e, 'preview_ttl_cleanup_failed'));
    }, 3_600_000);
  }
}
