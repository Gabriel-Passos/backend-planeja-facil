import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '@/src/common/types/prisma';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

interface ResolvedException {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolveException(exception);

    const body: ErrorResponseBody = {
      ...resolved,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // Loga o erro completo no servidor só quando é 500 —
    // erros esperados (400, 401, 404, 409...) não precisam poluir o log.
    if (resolved.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${resolved.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(resolved.statusCode).json(body);
  }

  private resolveException(exception: unknown): ResolvedException {
    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaKnownError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Dados inválidos enviados ao banco de dados.',
        error: 'Bad Request',
      };
    }

    // Qualquer erro não mapeado: nunca expõe stack trace ou mensagem
    // interna pro cliente — só loga no servidor (acima) e devolve algo genérico.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedException {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { statusCode, message: response, error: exception.name };
    }

    const responseObj = response as {
      message?: string | string[];
      error?: string;
    };

    return {
      statusCode,
      message: responseObj.message ?? exception.message,
      error: responseObj.error ?? exception.name,
    };
  }

  private resolvePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ResolvedException {
    switch (exception.code) {
      case 'P2002': {
        // Violação de constraint única (@unique / @@unique)
        const target = (exception.meta?.target as string[] | undefined)?.join(
          ', ',
        );
        return {
          statusCode: HttpStatus.CONFLICT,
          message: target
            ? `Já existe um registro com esse valor: ${target}.`
            : 'Registro duplicado.',
          error: 'Conflict',
        };
      }
      case 'P2025':
        // Registro que o Prisma esperava encontrar (ex: update/delete) não existe
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado.',
          error: 'Not Found',
        };
      case 'P2003':
        // Violação de chave estrangeira
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referência inválida — o registro relacionado não existe.',
          error: 'Bad Request',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro ao acessar o banco de dados.',
          error: 'Internal Server Error',
        };
    }
  }
}
