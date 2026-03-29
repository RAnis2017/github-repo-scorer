import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { GitHubModule } from '../github/github.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [GitHubModule, ScoringModule],
  controllers: [RepositoriesController],
})
export class RepositoriesModule {}
