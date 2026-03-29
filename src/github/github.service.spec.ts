import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { of, throwError, TimeoutError } from 'rxjs';
import { AxiosError, AxiosHeaders } from 'axios';
import { GitHubService } from './github.service';

function makeAxiosError(
  status: number,
  headers: Record<string, string> = {},
): AxiosError {
  const err = new AxiosError('error');
  err.response = {
    status,
    data: {},
    statusText: '',
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  };
  return err;
}

function makeRepoItem(overrides = {}) {
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
    updated_at: '2024-06-01T00:00:00Z',
    pushed_at: new Date().toISOString(),
    ...overrides,
  };
}

async function createService(
  httpGet: jest.Mock,
  cacheGet: jest.Mock = jest.fn().mockResolvedValue(null),
) {
  const module = await Test.createTestingModule({
    providers: [
      GitHubService,
      {
        provide: HttpService,
        useValue: { get: httpGet },
      },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            ({ 'github.apiUrl': 'https://api.github.com', 'github.token': '' })[
              key
            ] ?? null,
        },
      },
      {
        provide: CACHE_MANAGER,
        useValue: { get: cacheGet, set: jest.fn() },
      },
    ],
  }).compile();

  return module.get(GitHubService);
}

describe('GitHubService', () => {
  it('builds query string from language and date', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValue(of({ data: { items: [makeRepoItem()] } }));
    const svc = await createService(httpGet);

    await svc.searchRepositories('typescript', '2024-01-01', 1, 10);

    const [, options] = httpGet.mock.calls[0] as [
      string,
      { params: { q: string; page: number; per_page: number } },
    ];
    expect(options.params.q).toBe('language:typescript created:>=2024-01-01');
    expect(options.params.page).toBe(1);
    expect(options.params.per_page).toBe(10);
  });

  it('returns mapped DTOs from response', async () => {
    const item = makeRepoItem({ name: 'my-repo', stargazers_count: 500 });
    const httpGet = jest.fn().mockReturnValue(of({ data: { items: [item] } }));
    const svc = await createService(httpGet);

    const repos = await svc.searchRepositories(
      'typescript',
      '2024-01-01',
      1,
      10,
    );
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('my-repo');
    expect(repos[0].stargazers_count).toBe(500);
  });

  it('returns cached result without calling github', async () => {
    const cached = [makeRepoItem()];
    const cacheGet = jest.fn().mockResolvedValue(cached);
    const httpGet = jest.fn();
    const svc = await createService(httpGet, cacheGet);

    const result = await svc.searchRepositories(
      'typescript',
      '2024-01-01',
      1,
      10,
    );
    expect(result).toBe(cached);
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException on 403', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(403)));
    const svc = await createService(httpGet);

    await expect(
      svc.searchRepositories('typescript', '2024-01-01', 1, 10),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws BadRequestException on 422', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(422)));
    const svc = await createService(httpGet);

    await expect(
      svc.searchRepositories('typescript', '2024-01-01', 1, 10),
    ).rejects.toThrow(BadRequestException);
  });

  it('retries once on 500 then succeeds', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValueOnce(throwError(() => makeAxiosError(500)))
      .mockReturnValueOnce(of({ data: { items: [makeRepoItem()] } }));
    const svc = await createService(httpGet);

    const repos = await svc.searchRepositories(
      'typescript',
      '2024-01-01',
      1,
      10,
    );
    expect(repos).toHaveLength(1);
    expect(httpGet).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValue(throwError(() => makeAxiosError(400)));
    const svc = await createService(httpGet);

    await expect(
      svc.searchRepositories('typescript', '2024-01-01', 1, 10),
    ).rejects.toThrow(BadGatewayException);
    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('throws BadGatewayException when github request times out', async () => {
    const httpGet = jest
      .fn()
      .mockReturnValue(throwError(() => new TimeoutError()));
    const svc = await createService(httpGet);

    await expect(
      svc.searchRepositories('typescript', '2024-01-01', 1, 10),
    ).rejects.toThrow(BadGatewayException);
  });
});
