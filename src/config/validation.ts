import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(604800),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().integer().positive().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_FROM: Joi.string().email().required(),
  ZOOM_ACCOUNT_ID: Joi.string().required(),
  ZOOM_CLIENT_ID: Joi.string().required(),
  ZOOM_CLIENT_SECRET: Joi.string().required(),
  ZOOM_API_BASE_URL: Joi.string().uri().default('https://api.zoom.us/v2'),
  ZOOM_OAUTH_URL: Joi.string().uri().default('https://zoom.us/oauth/token'),
});
