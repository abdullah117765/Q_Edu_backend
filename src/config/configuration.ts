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
});
