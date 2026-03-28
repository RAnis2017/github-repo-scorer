import {
  Injectable,
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AxiosError } from 'axios';
import { GitHubRepoDto } from './dto/github-repo.dto';

@Injectable()
export class GitHubService {
  private readonly apiUrl: string;
  private readonly token: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.apiUrl = this.config.get<string>('github.apiUrl')!;
    this.token = this.config.get<string>('github.token') ?? '';
  }

  async searchRepositories(
    language: string,
    createdAfter: string,
    page: number,
    perPage: number,
  ): Promise<GitHubRepoDto[]> {
// TODO: swap to Redis for multi-instance deployments
    const cacheKey = `repos:${language}:${createdAfter}:${page}:${perPage}`;
    const cached = await this.cache.get<GitHubRepoDto[]>(cacheKey);
    if (cached) return cached;

    const q = `language:${language} created:>=${createdAfter}`;

    const params = { q, page, per_page: perPage, sort: 'stars', order: 'desc' };
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const data = await this.fetch({ params, headers });
    const repos = data.items.map((item: any) => this.mapRepo(item));
    await this.cache.set(cacheKey, repos);
    return repos;
  }

  // TODO: add circuit breaker for GitHub API calls
  private async fetch(options: { params: any; headers: Record<string, string> }, attempt = 1): Promise<any> {
    try {
      const res = await firstValueFrom(
        this.http
          .get(`${this.apiUrl}/search/repositories`, options)
          .pipe(timeout(10000)),
      );
      return res.data;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new BadGatewayException('GitHub API timed out');
      }

      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 403) {
        const reset = axiosErr.response?.headers['x-ratelimit-reset'];
        const msg = reset
          ? `retry after ${new Date(Number(reset) * 1000).toISOString()}`
          : 'rate limited';
        throw new ServiceUnavailableException(`GitHub rate limit exceeded — ${msg}`);
      }

      if (status === 422) {
        throw new BadRequestException('Invalid query sent to GitHub API');
      }

      if (status && status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1000));
        return this.fetch(options, 2);
      }

      throw new BadGatewayException('GitHub API error');
    }
  }

  private mapRepo(item: any): GitHubRepoDto {
    return {
      id: item.id,
      name: item.name,
      full_name: item.full_name,
      html_url: item.html_url,
      description: item.description,
      stargazers_count: item.stargazers_count,
      forks_count: item.forks_count,
      language: item.language,
      created_at: item.created_at,
      updated_at: item.updated_at,
      pushed_at: item.pushed_at,
    };
  }
}
