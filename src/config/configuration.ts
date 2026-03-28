export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  github: {
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    token: process.env.GITHUB_TOKEN ?? '',
  },
  scoring: {
    weightStars: parseFloat(process.env.SCORING_WEIGHT_STARS ?? '0.5'),
    weightForks: parseFloat(process.env.SCORING_WEIGHT_FORKS ?? '0.3'),
    weightRecency: parseFloat(process.env.SCORING_WEIGHT_RECENCY ?? '0.2'),
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL ?? '600', 10),
  },
});
