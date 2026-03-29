# github-repo-scorer

A NestJS REST API that searches GitHub repositories by language and creation date, then scores each one by popularity using a weighted combination of stars, forks, and how recently it was updated.

## How to run

**Local:**

```bash
npm install
cp .env.example .env
npm run start:dev
```

Swagger UI is available at `http://localhost:3000/api`.

**Docker:**

```bash
cp .env.example .env
docker-compose up --build
```

## API usage

```bash
curl "http://localhost:3000/repositories?language=typescript&createdAfter=2024-01-01"
```

All query params:

| Param | Required | Default | Notes |
|---|---|---|---|
| `language` | yes | | e.g. `typescript`, `go`, `python` |
| `createdAfter` | yes | | ISO date, e.g. `2024-01-01` |
| `sort` | no | `score` | `score`, `stars`, or `forks` |
| `order` | no | `desc` | `asc` or `desc` |
| `page` | no | `1` | |
| `perPage` | no | `10` | max `100` |

## Scoring algorithm

Each repository gets a raw score from three factors:

**Stars (weight 0.5):** `log2(1 + stars)`. Log scaling because star counts follow a power law distribution. Without it a 100k-star repo would completely drown out a 1k-star one, even if the smaller repo is more relevant to the query.

**Forks (weight 0.3):** `log2(1 + forks)`. Same log reasoning, but lower weight because forks tend to track stars pretty closely so they don't add as much independent signal.

**Recency (weight 0.2):** `max(0, 1 - daysSinceLastPush / 365)`. A repo pushed today scores 1.0 here; anything not touched in over a year scores 0. The weight is intentionally low so that stable, mature libraries don't get buried just because they don't need daily commits.

Raw scores are then normalized to a 0-100 range relative to the current batch of results. All three weights can be changed via environment variables (`SCORING_WEIGHT_STARS`, `SCORING_WEIGHT_FORKS`, `SCORING_WEIGHT_RECENCY`) without touching the code.

One thing worth noting about pagination: scores are calculated relative to whatever repos come back for the requested page, not across all pages globally. So the top result on page 2 will also show score 100, but that just means it ranked highest within that subset. True cross-page scoring would require fetching and storing every matching repo first, which is not practical here given GitHub's hard 1000-result cap on search queries and the infrastructure overhead of keeping those scores fresh.

## Running tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Trade-offs and future improvements

1. **No async ingestion pipeline.** Right now the API fetches and scores repos live on each request (with a short cache in front). For a production setup I would replace this with a background worker that periodically pulls repos from GitHub, pre-scores them, and stores the results in something like MongoDB. The API would then just read from that store. That way response times don't depend on GitHub being fast, rate limits become much less of a concern, and you can iterate on the scoring logic without it affecting the serving layer.

2. **In-memory cache.** Fine for a single instance but it doesn't survive restarts and won't work across multiple nodes. Redis is the obvious next step. The cache is already injected through `CACHE_MANAGER` so switching the backing store is basically a one-line config change.

3. **No authentication on the endpoint.** The risk is fairly low since we're just proxying a public API, but in a real service I'd put some form of API key or JWT validation in front of it.

4. **Rate limiting.** The endpoint is protected with `@nestjs/throttler` at 60 requests per minute per IP. This prevents a single client from exhausting the GitHub quota. In a full production setup this would be paired with API key auth to make per-client limits meaningful rather than just per-IP.

5. **CI/CD.** A GitHub Actions workflow runs lint, build, and tests on every push and pull request to main.

6. **Scoring signal quality.** There's a lot more you could factor in: open issues ratio, number of contributors, license type, dependency health. With enough historical data you could also learn the weights automatically rather than hand-tuning them.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GITHUB_API_URL` | `https://api.github.com` | GitHub API base URL |
| `GITHUB_TOKEN` | (empty) | Optional PAT for higher rate limits (5000 req/hr vs 60) |
| `SCORING_WEIGHT_STARS` | `0.5` | Star score weight |
| `SCORING_WEIGHT_FORKS` | `0.3` | Fork score weight |
| `SCORING_WEIGHT_RECENCY` | `0.2` | Recency score weight |
| `CACHE_TTL` | `600` | Cache TTL in seconds |
| `PORT` | `3000` | HTTP port |
