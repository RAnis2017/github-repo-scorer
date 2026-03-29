import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RepositoriesModule } from './repositories/repositories.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: config.get<number>('cache.ttl')! * 1000,
      }),
    }),
    RepositoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
