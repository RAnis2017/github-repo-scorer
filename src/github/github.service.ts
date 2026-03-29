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

interface GitHubRawRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

interface GitHubSearchResponse {
  items: GitHubRawRepo[];
}

interface SearchParams {
  q: string;
  page: number;
  per_page: number;
  sort: string;
  order: string;
}

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
    // using in-memory cache for now, would swap to Redis for multi-instance deployments
    const cacheKey = `repos:${language}:${createdAfter}:${page}:${perPage}`;
    const cached = await this.cache.get<GitHubRepoDto[]>(cacheKey);
    if (cached) return cached;

    const q = `language:${language} created:>=${createdAfter}`;

    const params = { q, page, per_page: perPage, sort: 'stars', order: 'desc' };
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const data = await this.fetch({ params, headers });
    const repos = data.items.map((item) => this.mapRepo(item));
    await this.cache.set(cacheKey, repos);
    return repos;
  }

  // a circuit breaker would be a good addition here to avoid hammering GitHub when it's having issues
  private async fetch(
    options: { params: SearchParams; headers: Record<string, string> },
    attempt = 1,
  ): Promise<GitHubSearchResponse> {
    try {
      const res = await firstValueFrom(
        this.http
          .get(`${this.apiUrl}/search/repositories`, options)
          .pipe(timeout(10000)),
      );
      return res.data as GitHubSearchResponse;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new BadGatewayException('GitHub API timed out');
      }

      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      if (status === 403) {
        const reset = axiosErr.response?.headers['x-ratelimit-reset'] as
          | string
          | undefined;
        const msg = reset
          ? `retry after ${new Date(Number(reset) * 1000).toISOString()}`
          : 'rate limited';
        throw new ServiceUnavailableException(
          `GitHub rate limit exceeded, ${msg}`,
        );
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

  private mapRepo(item: GitHubRawRepo): GitHubRepoDto {
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
