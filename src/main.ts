import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos que não estão no DTO
      forbidNonWhitelisted: true, // 400 se vier campo extra não esperado
      transform: true, // converte o payload em instância da classe DTO
      transformOptions: {
        enableImplicitConversion: true, // ex: @IsInt() aceita "3" vindo de query params
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:5173',
  );

  app.enableCors({
    origin: frontendUrl,
    credentials: true, // necessário se/quando o refresh token for pra cookie httpOnly
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Planeja Fácil API')
    .setDescription('Documentação da API do backend')
    .setVersion('1.0')
    .addBearerAuth() // habilita o campo de token JWT na UI do Swagger
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
