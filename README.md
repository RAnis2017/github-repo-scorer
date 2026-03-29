# github-repo-scorer

A NestJS REST API that searches GitHub repositories by language and creation date, then scores each one by popularity using a weighted combination of stars, forks, and update recency.

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
docker-compose up --build
```

## API usage

```bash
curl "http://localhost:3000/repositories?language=typescript&createdAfter=2024-01-01"
```

All query params:

| Param | Required | Default | Notes |
|---|---|---|---|
| `language` | yes | — | e.g. `typescript`, `go`, `python` |
| `createdAfter` | yes | — | ISO date, e.g. `2024-01-01` |
| `sort` | no | `score` | `score`, `stars`, or `forks` |
| `order` | no | `desc` | `asc` or `desc` |
| `page` | no | `1` | |
| `perPage` | no | `10` | max `100` |

## Scoring algorithm

Each repository gets a raw score from three factors:

**Stars (weight 0.5)** — `log₂(1 + stars)`. Log scaling because GitHub star counts follow a power law distribution. Linear scoring would let a 100k-star repo completely dominate a 1k-star one; log compression makes the meaningful range feel proportional.

**Forks (weight 0.3)** — `log₂(1 + forks)`. Same log rationale, lower weight because forks correlate heavily with stars already — they're a weaker independent signal.

**Recency (weight 0.2)** — `max(0, 1 - daysSinceLastPush / 365)`. A repo pushed today gets full recency credit; anything untouched for over a year gets zero. Lower weight than stars because mature, stable libraries shouldn't be penalised just for not needing daily commits.

Raw scores are normalized to 0–100 relative to the batch. All three weights are configurable via environment variables (`SCORING_WEIGHT_STARS`, `SCORING_WEIGHT_FORKS`, `SCORING_WEIGHT_RECENCY`) so they can be tuned without code changes.

This is a simplified model. A production scorer would benefit from additional signals and possibly learned weights.

## Running tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Trade-offs and future improvements

1. **No async ingestion pipeline.** The API currently fetches and scores repos on each request (with caching). In a production system I'd introduce an async pipeline — a scheduled worker or RabbitMQ-driven consumer that periodically fetches trending repos, pre-scores them, and writes to a persistent store like MongoDB. The API would then read from that store instead of calling GitHub directly. This decouples response times from a third-party dependency, eliminates rate limit concerns, and lets the scoring logic evolve independently of the serving path.

2. **In-memory cache.** Works fine for a single instance but doesn't survive restarts and won't scale horizontally. Redis would be the natural next step. The cache injection point is already abstracted behind `CACHE_MANAGER` so swapping the store is a one-line config change (see the TODO in `github.service.ts`).

3. **No authentication on the endpoint.** Since it proxies a public API the risk is low, but in production I'd add API key validation or JWT middleware.

4. **No rate limiting on our own endpoint.** A bad actor could hammer the service and exhaust our GitHub quota even with caching. `@nestjs/throttler` would handle this in a few lines.

5. **No CI/CD.** GitHub Actions for automated test runs and Docker image builds would be a straightforward addition.

6. **Scoring signal quality.** More signals — open issues ratio, contributor count, license type, dependency health — would improve accuracy. With enough historical data, learned weights (even a simple linear regression) would outperform hand-tuned ones.
