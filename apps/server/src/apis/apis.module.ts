import { Module } from '@nestjs/common';
import { GithubModule } from './github/github.module';
import { ProjectsModule } from './projects/projects.module';
import { TestModule } from './test/test.module';

@Module({
  imports: [TestModule, GithubModule, ProjectsModule],
})
export class ApisModule {}
