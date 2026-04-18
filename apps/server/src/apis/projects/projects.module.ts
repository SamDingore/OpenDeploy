import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DeploymentOrchestratorService } from './deployment-orchestrator.service';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [DeploymentOrchestratorService],
})
export class ProjectsModule {}
