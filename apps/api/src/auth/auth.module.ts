import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [AuthService, ClerkAuthGuard],
  exports: [AuthService, ClerkAuthGuard],
})
export class AuthModule {}
