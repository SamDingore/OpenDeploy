import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubOAuthService } from './github-oauth.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GithubController],
  providers: [GithubOAuthService],
})
export class GithubModule {}
