import { Module } from '@nestjs/common';
import { GithubModule } from './github/github.module';
import { TestModule } from './test/test.module';

@Module({
  imports: [TestModule, GithubModule],
})
export class ApisModule {}
