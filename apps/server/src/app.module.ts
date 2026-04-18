import { Module } from '@nestjs/common';
import { ApisModule } from './apis/apis.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, ApisModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
