import { join } from 'path';

const parseAllowedOrigins = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const ensureLeadingSlash = (value: string): string => {
  if (!value) {
    return '/storage';
  }
  return value.startsWith('/') ? value : `/${value}`;
};

const parseNonNegativeInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
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
    refreshTokenTtlSeconds: parseInt(
      process.env.JWT_REFRESH_TTL_SECONDS ?? '604800',
      10,
    ),
    accessTokenCookieName:
      process.env.AUTH_ACCESS_TOKEN_COOKIE_NAME ?? 'qedu_access_token',
    refreshTokenCookieName:
      process.env.AUTH_REFRESH_TOKEN_COOKIE_NAME ?? 'qedu_refresh_token',
    cookieDomain: (() => {
      const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
      return domain ? domain : undefined;
    })(),
    cookieSecure:
      (process.env.AUTH_COOKIE_SECURE ?? 'true').toLowerCase() === 'true',
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
  zoom: (() => {
    const accountId = process.env.ZOOM_ACCOUNT_ID?.trim() ?? '';
    const clientId = process.env.ZOOM_CLIENT_ID?.trim() ?? '';
    const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim() ?? '';
    const explicitEnabled =
      process.env.ZOOM_ENABLED?.toLowerCase() === 'true' ||
      process.env.ZOOM_ENABLED?.toLowerCase() === 'false'
        ? process.env.ZOOM_ENABLED?.toLowerCase() === 'true'
        : null;
    const inferredEnabled = Boolean(accountId && clientId && clientSecret);
    const enabled = explicitEnabled ?? inferredEnabled;

    return {
      enabled,
      accountId,
      clientId,
      clientSecret,
      apiBaseUrl: process.env.ZOOM_API_BASE_URL ?? 'https://api.zoom.us/v2',
      oauthUrl: process.env.ZOOM_OAUTH_URL ?? 'https://zoom.us/oauth/token',
    };
  })(),
  cors: {
    allowedOrigins: parseAllowedOrigins(
      process.env.CORS_ALLOWED_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? '',
    ),
  },
  classes: {
    scheduledClassCreditCost: parseNonNegativeInteger(
      process.env.ZOOM_CLASS_CREDIT_COST,
      1,
    ),
  },
  billing: {
    academyOwnerInitialFreeCredits: parseNonNegativeInteger(
      process.env.ACADEMY_OWNER_INITIAL_FREE_CREDITS,
      100,
    ),
  },
  storage: (() => {
    const driver = (process.env.FILE_STORAGE_DRIVER ?? 'local').toLowerCase();
    const localRoot =
      process.env.LOCAL_STORAGE_ROOT &&
      process.env.LOCAL_STORAGE_ROOT.trim().length > 0
        ? process.env.LOCAL_STORAGE_ROOT.trim()
        : join(process.cwd(), 'storage', 'uploads');

    return {
      driver,
      local: {
        root: localRoot,
      },
      publicServeRoot: ensureLeadingSlash(
        process.env.FILE_STORAGE_PUBLIC_ROOT ?? '/storage',
      ),
      publicBaseUrl: process.env.FILE_STORAGE_PUBLIC_URL?.trim() || '',
    };
  })(),
  stripe: (() => {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
    const platformFeePercentRaw = parseFloat(
      process.env.PLATFORM_FEE_PERCENT ?? '10',
    );
    const platformFeePercent = Number.isFinite(platformFeePercentRaw)
      ? Math.max(0, Math.min(100, platformFeePercentRaw))
      : 10;
    return {
      enabled: secretKey.length > 0,
      secretKey,
      publishableKey,
      webhookSecret,
      apiVersion: (process.env.STRIPE_API_VERSION ?? '2024-06-20') as string,
      currency: (process.env.STRIPE_CURRENCY ?? 'usd').toLowerCase(),
      platformFeePercent,
      successUrl:
        process.env.STRIPE_SUCCESS_URL ??
        'http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl:
        process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/billing/cancel',
      portalReturnUrl:
        process.env.STRIPE_PORTAL_RETURN_URL ??
        'http://localhost:5173/academy/billing',
    };
  })(),
  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL?.trim() ?? '',
    password: process.env.SUPER_ADMIN_PASSWORD ?? '',
    firstName: process.env.SUPER_ADMIN_FIRST_NAME?.trim() || 'Super',
    lastName: process.env.SUPER_ADMIN_LAST_NAME?.trim() || 'Admin',
  },
});
