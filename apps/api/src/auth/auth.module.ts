import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { MeController } from './me.controller';
import { WorkspaceAccessGuard } from './workspace-access.guard';

@Global()
@Module({
  controllers: [MeController],
  providers: [AuthService, ClerkAuthGuard, WorkspaceAccessGuard],
  exports: [AuthService, ClerkAuthGuard, WorkspaceAccessGuard],
})
export class AuthModule {}
