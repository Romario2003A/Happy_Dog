import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'production' || config.get('RENDER') === 'true';
  const allowedOrigins = (config.get<string>('CORS_ORIGIN') || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.use('/api/auth', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  if (!isProduction || config.get('ENABLE_SWAGGER') === 'true') {
    const swagger = new DocumentBuilder().setTitle('Happy Dog API').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  }
  await app.listen(config.get<number>('PORT') || 3000);
}
bootstrap();
