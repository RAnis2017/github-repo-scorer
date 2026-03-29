import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { GitHubService } from '../github/github.service';
import { ScoringService } from '../scoring/scoring.service';
import { SearchReposDto } from './dto/search-repos.dto';
import { ScoredRepoDto } from './dto/scored-repo.dto';

@ApiTags('repositories')
@Controller('repositories')
export class RepositoriesController {
  constructor(
    private readonly github: GitHubService,
    private readonly scoring: ScoringService,
  ) {}

  @Get()
  @ApiQuery({ name: 'language', required: true })
  @ApiQuery({ name: 'createdAfter', required: true })
  @ApiQuery({ name: 'sort', required: false, enum: ['score', 'stars', 'forks'] })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'perPage', required: false })
  @ApiResponse({ status: 200, type: [ScoredRepoDto] })
  @ApiResponse({ status: 400, description: 'Invalid query params' })
  @ApiResponse({ status: 503, description: 'GitHub rate limit exceeded' })
  async getRepositories(@Query() query: SearchReposDto): Promise<ScoredRepoDto[]> {
    const repos = await this.github.searchRepositories(
      query.language,
      query.createdAfter,
      query.page,
      query.perPage,
    );

    const scored = this.scoring.scoreRepositories(repos);
    return this.sort(scored, query.sort, query.order);
  }

  private sort(repos: ScoredRepoDto[], by: string, order: 'asc' | 'desc'): ScoredRepoDto[] {
    const fieldMap: Record<string, keyof ScoredRepoDto> = {
      score: 'score',
      stars: 'stargazers_count',
      forks: 'forks_count',
    };
    const field = fieldMap[by] ?? 'score';

    return [...repos].sort((a, b) => {
      const diff = (a[field] as number) - (b[field] as number);
      return order === 'asc' ? diff : -diff;
    });
  }
}
