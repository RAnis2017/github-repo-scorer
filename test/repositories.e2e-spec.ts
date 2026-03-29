import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GitHubService } from '../src/github/github.service';

function makeFakeRepo(overrides = {}) {
  return {
    id: 1,
    name: 'fake-repo',
    full_name: 'owner/fake-repo',
    html_url: 'https://github.com/owner/fake-repo',
    description: null,
    stargazers_count: 1000,
    forks_count: 100,
    language: 'typescript',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    pushed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('/repositories (e2e)', () => {
  let app: INestApplication<App>;
  let githubService: GitHubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();

    githubService = module.get(GitHubService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with scored repo array', async () => {
    jest
      .spyOn(githubService, 'searchRepositories')
      .mockResolvedValue([
        makeFakeRepo({ id: 1, stargazers_count: 2000 }),
        makeFakeRepo({ id: 2, stargazers_count: 500 }),
      ]);

    const res = await request(app.getHttpServer())
      .get('/repositories')
      .query({ language: 'typescript', createdAfter: '2024-01-01' })
      .expect(200);

    const body = res.body as Record<string, unknown>[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('score');
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('stargazers_count');
  });

  it('returns results sorted desc by score by default', async () => {
    jest.spyOn(githubService, 'searchRepositories').mockResolvedValue([
      makeFakeRepo({
        id: 1,
        stargazers_count: 100,
        pushed_at: new Date(Date.now() - 300 * 86400000).toISOString(),
      }),
      makeFakeRepo({ id: 2, stargazers_count: 50000 }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/repositories')
      .query({ language: 'typescript', createdAfter: '2024-01-01' })
      .expect(200);

    const body = res.body as Array<{ score: number }>;
    expect(body[0].score).toBeGreaterThanOrEqual(body[body.length - 1].score);
  });

  it('returns 400 when language is missing', async () => {
    await request(app.getHttpServer())
      .get('/repositories')
      .query({ createdAfter: '2024-01-01' })
      .expect(400);
  });

  it('returns 400 when createdAfter is missing', async () => {
    await request(app.getHttpServer())
      .get('/repositories')
      .query({ language: 'typescript' })
      .expect(400);
  });

  it('returns 400 when perPage exceeds 100', async () => {
    await request(app.getHttpServer())
      .get('/repositories')
      .query({
        language: 'typescript',
        createdAfter: '2024-01-01',
        perPage: 200,
      })
      .expect(400);
  });

  it('returns 400 when createdAfter is not a date string', async () => {
    await request(app.getHttpServer())
      .get('/repositories')
      .query({ language: 'typescript', createdAfter: 'not-a-date' })
      .expect(400);
  });
});
