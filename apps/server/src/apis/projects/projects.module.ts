import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsController } from './projects.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
})
export class ProjectsModule {}
