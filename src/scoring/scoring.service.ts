import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitHubRepoDto } from '../github/dto/github-repo.dto';

export interface ScoredRepo extends GitHubRepoDto {
  score: number;
}

@Injectable()
export class ScoringService {
  private readonly weightStars: number;
  private readonly weightForks: number;
  private readonly weightRecency: number;

  constructor(private readonly config: ConfigService) {
    this.weightStars = this.config.get<number>('scoring.weightStars')!;
    this.weightForks = this.config.get<number>('scoring.weightForks')!;
    this.weightRecency = this.config.get<number>('scoring.weightRecency')!;
  }

  scoreRepositories(repos: GitHubRepoDto[]): ScoredRepo[] {
    if (repos.length === 0) return [];

    const raw = repos.map((r) => ({ repo: r, raw: this.rawScore(r) }));
    const max = Math.max(...raw.map((r) => r.raw));

    // if max is 0 all repos are equal, just give them all 100
    return raw.map(({ repo, raw: r }) => ({
      ...repo,
      score: max === 0 ? 100 : Math.round((r / max) * 100),
    }));
  }

  private rawScore(repo: GitHubRepoDto): number {
    const starScore = Math.log2(1 + (repo.stargazers_count || 0));
    const forkScore = Math.log2(1 + (repo.forks_count || 0));

    const pushedMs = repo.pushed_at ? new Date(repo.pushed_at).getTime() : 0;
    const daysSincePush =
      pushedMs > 0 ? (Date.now() - pushedMs) / 86_400_000 : 365;
    const recencyScore = Math.max(0, 1 - daysSincePush / 365);

    return (
      starScore * this.weightStars +
      forkScore * this.weightForks +
      recencyScore * this.weightRecency
    );
  }
}
