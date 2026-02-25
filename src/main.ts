import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import compression from '@fastify/compress';
import { CustomValidationPipe, GlobalExceptionFilter } from './common';
import { SwaggerConfig } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(compression);

  const swaggerConfig = app.get(SwaggerConfig);

  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  if (swaggerConfig.enabled) {
    const builder = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .setContact(swaggerConfig.contactName, '', swaggerConfig.contactEmail)
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT Authorization header using the Bearer scheme. Format: Bearer <token>',
        },
        'bearerAuth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API Key for application authentication.',
        },
        'apiKeyAuth',
      )
      .addTag(
        'Auth',
        'Authentication endpoints — register, login, token refresh, password reset, logout.',
      )
      .addTag(
        'Users',
        'User management — CRUD, profile, roles, activation. Requires authentication.',
      )
      .addTag(
        'Downloads',
        'Video download endpoints — start downloads, check status, get history.',
      )
      .addTag('Health', 'Health check and monitoring endpoints.');

    for (const server of swaggerConfig.getServers()) {
      builder.addServer(server.url, server.description);
    }

    const config = builder.build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerConfig.path, app, document, {
      swaggerOptions: {
        docExpansion: 'list',
        deepLinking: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
        persistAuthorization: true,
      },
    });
  }

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRoute', (opts) => {
      console.log(`Route registered: ${opts.method} ${opts.url}`);
    });

  await app.listen(process.env.PORT ?? 8000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
