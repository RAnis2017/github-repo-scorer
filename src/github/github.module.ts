import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GitHubService } from './github.service';

@Module({
  imports: [HttpModule],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
