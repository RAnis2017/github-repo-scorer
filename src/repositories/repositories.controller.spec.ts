import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { GitHubService } from '../github/github.service';
import { ScoringService } from '../scoring/scoring.service';

function makeScoredRepo(overrides = {}) {
  return {
    id: 1,
    name: 'repo',
    full_name: 'owner/repo',
    html_url: 'https://github.com/owner/repo',
    description: null,
    stargazers_count: 500,
    forks_count: 50,
    language: 'typescript',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    pushed_at: new Date().toISOString(),
    score: 80,
    ...overrides,
  };
}

async function createController(
  searchRepos: jest.Mock,
  scoreRepositories: jest.Mock,
) {
  const module = await Test.createTestingModule({
    controllers: [RepositoriesController],
    providers: [
      { provide: GitHubService, useValue: { searchRepositories: searchRepos } },
      { provide: ScoringService, useValue: { scoreRepositories: scoreRepositories } },
    ],
  }).compile();

  return module.get(RepositoriesController);
}

describe('RepositoriesController', () => {
  it('returns scored results in desc order by default', async () => {
    const repos = [makeScoredRepo({ score: 40, id: 1 }), makeScoredRepo({ score: 90, id: 2 }), makeScoredRepo({ score: 60, id: 3 })];
    const ctrl = await createController(
      jest.fn().mockResolvedValue(repos),
      jest.fn().mockReturnValue(repos),
    );

    const result = await ctrl.getRepositories({
      language: 'typescript',
      createdAfter: '2024-01-01',
      sort: 'score',
      order: 'desc',
      page: 1,
      perPage: 10,
    });

    expect(result[0].score).toBe(90);
    expect(result[result.length - 1].score).toBe(40);
  });

  it('returns results in asc order when requested', async () => {
    const repos = [makeScoredRepo({ score: 40, id: 1 }), makeScoredRepo({ score: 90, id: 2 })];
    const ctrl = await createController(
      jest.fn().mockResolvedValue(repos),
      jest.fn().mockReturnValue(repos),
    );

    const result = await ctrl.getRepositories({
      language: 'typescript',
      createdAfter: '2024-01-01',
      sort: 'score',
      order: 'asc',
      page: 1,
      perPage: 10,
    });

    expect(result[0].score).toBe(40);
    expect(result[1].score).toBe(90);
  });

  it('can sort by stars', async () => {
    const repos = [
      makeScoredRepo({ stargazers_count: 100, id: 1 }),
      makeScoredRepo({ stargazers_count: 5000, id: 2 }),
    ];
    const ctrl = await createController(
      jest.fn().mockResolvedValue(repos),
      jest.fn().mockReturnValue(repos),
    );

    const result = await ctrl.getRepositories({
      language: 'typescript',
      createdAfter: '2024-01-01',
      sort: 'stars',
      order: 'desc',
      page: 1,
      perPage: 10,
    });

    expect(result[0].stargazers_count).toBe(5000);
  });

  it('passes pagination params to github service', async () => {
    const searchRepos = jest.fn().mockResolvedValue([]);
    const ctrl = await createController(searchRepos, jest.fn().mockReturnValue([]));

    await ctrl.getRepositories({
      language: 'go',
      createdAfter: '2023-06-01',
      sort: 'score',
      order: 'desc',
      page: 3,
      perPage: 25,
    });

    expect(searchRepos).toHaveBeenCalledWith('go', '2023-06-01', 3, 25);
  });
});
