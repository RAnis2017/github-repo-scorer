import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ScoringService } from './scoring.service';
import { GitHubRepoDto } from '../github/dto/github-repo.dto';

const defaultWeights = {
  'scoring.weightStars': 0.5,
  'scoring.weightForks': 0.3,
  'scoring.weightRecency': 0.2,
};

function makeRepo(overrides: Partial<GitHubRepoDto> = {}): GitHubRepoDto {
  return {
    id: 1,
    name: 'test-repo',
    full_name: 'owner/test-repo',
    html_url: 'https://github.com/owner/test-repo',
    description: null,
    stargazers_count: 100,
    forks_count: 10,
    language: 'typescript',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    pushed_at: new Date().toISOString(),
    ...overrides,
  };
}

async function createService(weights = defaultWeights) {
  const module = await Test.createTestingModule({
    providers: [
      ScoringService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => weights[key as keyof typeof weights],
        },
      },
    ],
  }).compile();
  return module.get(ScoringService);
}

describe('ScoringService', () => {
  it('more stars → higher score', async () => {
    const svc = await createService();
    const [low, high] = svc.scoreRepositories([
      makeRepo({ stargazers_count: 10 }),
      makeRepo({ id: 2, stargazers_count: 10000 }),
    ]);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('recently pushed repo scores higher than stale one', async () => {
    const svc = await createService();
    const recentDate = new Date().toISOString();
    const staleDate = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const [stale, recent] = svc.scoreRepositories([
      makeRepo({ stargazers_count: 100, pushed_at: staleDate }),
      makeRepo({ id: 2, stargazers_count: 100, pushed_at: recentDate }),
    ]);
    expect(recent.score).toBeGreaterThan(stale.score);
  });

  it('zero activity repo gets a low score', async () => {
    const svc = await createService();
    const staleDate = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const [active, zeroed] = svc.scoreRepositories([
      makeRepo({ stargazers_count: 5000 }),
      makeRepo({
        id: 2,
        stargazers_count: 0,
        forks_count: 0,
        pushed_at: staleDate,
      }),
    ]);
    expect(zeroed.score).toBeLessThan(active.score);
  });

  it('scores are always between 0 and 100', async () => {
    const svc = await createService();
    const repos = [
      makeRepo({
        stargazers_count: 0,
        forks_count: 0,
        pushed_at: new Date(0).toISOString(),
      }),
      makeRepo({ id: 2, stargazers_count: 100000, forks_count: 50000 }),
    ];
    const scored = svc.scoreRepositories(repos);
    scored.forEach((r) => {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  it('single repo gets score of 100', async () => {
    const svc = await createService();
    const [result] = svc.scoreRepositories([makeRepo()]);
    expect(result.score).toBe(100);
  });

  it('all identical repos do not throw and all get 100', async () => {
    const svc = await createService();
    const repos = [makeRepo(), makeRepo({ id: 2 }), makeRepo({ id: 3 })];
    expect(() => svc.scoreRepositories(repos)).not.toThrow();
    const scored = svc.scoreRepositories(repos);
    scored.forEach((r) => expect(r.score).toBe(100));
  });

  it('changing star weight affects scores', async () => {
    const heavyStars = { ...defaultWeights, 'scoring.weightStars': 0.9 };
    const lightStars = { ...defaultWeights, 'scoring.weightStars': 0.1 };
    const repos = [
      makeRepo({ stargazers_count: 1 }),
      makeRepo({ id: 2, stargazers_count: 50000 }),
    ];

    const svcHeavy = await createService(heavyStars);
    const svcLight = await createService(lightStars);

    const [lowHeavy] = svcHeavy.scoreRepositories(repos);
    const [lowLight] = svcLight.scoreRepositories(repos);

    // low-star repo is penalised more when star weight is heavy
    expect(lowLight.score).toBeGreaterThan(lowHeavy.score);
  });

  it('empty array returns empty array', async () => {
    const svc = await createService();
    expect(svc.scoreRepositories([])).toEqual([]);
  });
});
