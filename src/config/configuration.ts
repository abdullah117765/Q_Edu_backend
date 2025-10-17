const parseAllowedOrigins = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshTokenTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? '604800', 10),
    accessTokenCookieName: process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME ?? 'qedu_access_token',
    refreshTokenCookieName: process.env.AUTH_REFRESH_TOKEN_COOKIE_NAME ?? 'qedu_refresh_token',
    cookieDomain: (() => {
      const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
      return domain ? domain : undefined;
    })(),
    cookieSecure: (process.env.AUTH_COOKIE_SECURE ?? 'true').toLowerCase() === 'true',
    cookieSameSite: (() => {
      const value = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase();
      return ['lax', 'strict', 'none'].includes(value) ? value : 'lax';
    })(),
  },
  email: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
    from: process.env.SMTP_FROM ?? '',
  },
  zoom: {
    accountId: process.env.ZOOM_ACCOUNT_ID ?? '',
    clientId: process.env.ZOOM_CLIENT_ID ?? '',
    clientSecret: process.env.ZOOM_CLIENT_SECRET ?? '',
    apiBaseUrl: process.env.ZOOM_API_BASE_URL ?? 'https://api.zoom.us/v2',
    oauthUrl: process.env.ZOOM_OAUTH_URL ?? 'https://zoom.us/oauth/token',
  },
  cors: {
    allowedOrigins: parseAllowedOrigins(
      process.env.CORS_ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? '',
    ),
  },
});
