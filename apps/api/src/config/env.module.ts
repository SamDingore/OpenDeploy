import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env';
import { OPENDEPLOY_ENV } from './env.constants';

@Global()
@Module({
  providers: [
    {
      provide: OPENDEPLOY_ENV,
      useFactory: () => loadEnv(),
    },
  ],
  exports: [OPENDEPLOY_ENV],
})
export class EnvModule {}
