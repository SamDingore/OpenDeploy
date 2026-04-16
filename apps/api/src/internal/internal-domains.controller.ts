import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { success } from '@opendeploy/shared';
import { CustomDomainsService } from '../custom-domains/custom-domains.service';
import { InternalSecretGuard } from './internal-secret.guard';

@Controller('internal/domains')
@UseGuards(InternalSecretGuard)
export class InternalDomainsController {
  constructor(private readonly customDomains: CustomDomainsService) {}

  @Post('reconcile/run')
  async reconcile() {
    await this.customDomains.executeReconcile();
    return success({ ok: true });
  }

  @Post(':customDomainId/run-verify')
  async verify(@Param('customDomainId') customDomainId: string) {
    await this.customDomains.executeVerify(customDomainId);
    return success({ ok: true });
  }

  @Post(':customDomainId/run-certificate-issue')
  async issue(@Param('customDomainId') customDomainId: string) {
    await this.customDomains.executeCertificateIssue(customDomainId);
    return success({ ok: true });
  }

  @Post(':customDomainId/run-certificate-renew')
  async renew(@Param('customDomainId') customDomainId: string) {
    await this.customDomains.executeCertificateRenew(customDomainId);
    return success({ ok: true });
  }

  @Post(':customDomainId/run-attach')
  async attach(@Param('customDomainId') customDomainId: string) {
    await this.customDomains.executeAttach(customDomainId);
    return success({ ok: true });
  }

  @Post(':customDomainId/run-detach')
  async detach(@Param('customDomainId') customDomainId: string) {
    await this.customDomains.executeDetach(customDomainId);
    return success({ ok: true });
  }
}
