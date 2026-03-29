function requirePositiveFloat(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = parseFloat(value ?? String(fallback));
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid configuration: ${name} must be a positive number (got "${value}")`,
    );
  }
  return parsed;
}

function requirePositiveInt(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid configuration: ${name} must be a positive integer (got "${value}")`,
    );
  }
  return parsed;
}

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  github: {
    apiUrl: process.env.GITHUB_API_URL ?? 'https://api.github.com',
    token: process.env.GITHUB_TOKEN ?? '',
  },
  scoring: {
    weightStars: requirePositiveFloat(
      process.env.SCORING_WEIGHT_STARS,
      0.5,
      'SCORING_WEIGHT_STARS',
    ),
    weightForks: requirePositiveFloat(
      process.env.SCORING_WEIGHT_FORKS,
      0.3,
      'SCORING_WEIGHT_FORKS',
    ),
    weightRecency: requirePositiveFloat(
      process.env.SCORING_WEIGHT_RECENCY,
      0.2,
      'SCORING_WEIGHT_RECENCY',
    ),
  },
  cache: {
    ttl: requirePositiveInt(process.env.CACHE_TTL, 600, 'CACHE_TTL'),
  },
});
