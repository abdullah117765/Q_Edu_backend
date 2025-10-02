import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const environment = configService.get<string>('app.env') ?? 'development';
  const isProduction = environment === 'production';

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Q Edu API')
      .setDescription('API documentation for the Q Edu platform')
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);

  const appUrl = await app.getUrl();
  logger.log(`Application started in ${environment} mode on ${appUrl}`);
  logger.log(`API base URL: ${appUrl}/api`);

  if (!isProduction) {
    logger.log(`Swagger UI: ${appUrl}/docs`);
  }
}

bootstrap();
