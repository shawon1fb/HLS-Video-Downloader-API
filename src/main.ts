import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
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

  // Get configuration
  const swaggerConfig = app.get(SwaggerConfig);

  // Global request logging
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // Apply global security measures
  app.useGlobalPipes(new CustomValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // Enable CORS for API endpoints
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || false
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Register Swagger documentation
  if (swaggerConfig.enabled) {
    await app.register(require('@fastify/swagger'), swaggerConfig.getSwaggerOptions());
    await app.register(require('@fastify/swagger-ui'), {
      routePrefix: swaggerConfig.path,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => {
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });
  }
  // Log all available routes using Fastify's onRoute hook
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRoute', (opts) => {
      console.log(`Route registered: ${opts.method} ${opts.url}`);
    });

  await app.listen(process.env.PORT ?? 8000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log('All routes have been logged above during registration.');
}
bootstrap();
