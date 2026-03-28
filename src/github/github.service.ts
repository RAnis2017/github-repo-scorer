import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GitHubRepoDto } from './dto/github-repo.dto';

@Injectable()
export class GitHubService {
  private readonly apiUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.apiUrl = this.config.get<string>('github.apiUrl')!;
  }

  async searchRepositories(
    language: string,
    createdAfter: string,
    page: number,
    perPage: number,
  ): Promise<GitHubRepoDto[]> {
    const q = `language:${language} created:>=${createdAfter}`;
    const params = { q, page, per_page: perPage, sort: 'stars', order: 'desc' };
    const headers = { Accept: 'application/vnd.github+json' };

    const res = await firstValueFrom(
      this.http.get(`${this.apiUrl}/search/repositories`, { params, headers }),
    );
    return res.data.items.map((item: any) => this.mapRepo(item));
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
