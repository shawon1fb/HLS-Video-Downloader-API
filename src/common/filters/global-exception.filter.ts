import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errors = responseObj.errors;
      } else {
        message = exceptionResponse as string;
      }
    }

    // Log the error for debugging (but don't expose sensitive info)
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Sanitize error response for production
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.sanitizeMessage(message, status),
      ...(errors && { errors: this.sanitizeErrors(errors) }),
    };

    // Remove sensitive information in production
    if (process.env.NODE_ENV === 'production') {
      delete errorResponse.path;
      delete errorResponse.method;
      
      // Generic error messages for server errors in production
      if (status >= 500) {
        errorResponse.message = 'Internal server error';
        delete errorResponse.errors;
      }
    }

    response.status(status).send(errorResponse);
  }

  private sanitizeMessage(message: string | string[], status: number): string | string[] {
    if (process.env.NODE_ENV === 'production' && status >= 500) {
      return 'Internal server error';
    }

    if (Array.isArray(message)) {
      return message.map(msg => this.removeSensitiveInfo(msg));
    }

    return this.removeSensitiveInfo(message);
  }

  private sanitizeErrors(errors: any): any {
    if (process.env.NODE_ENV === 'production') {
      return undefined;
    }

    if (Array.isArray(errors)) {
      return errors.map(error => this.removeSensitiveInfo(error));
    }

    if (typeof errors === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(errors)) {
        sanitized[key] = this.removeSensitiveInfo(value as string);
      }
      return sanitized;
    }

    return this.removeSensitiveInfo(errors);
  }

  private removeSensitiveInfo(text: string): string {
    if (typeof text !== 'string') {
      return text;
    }

    // Remove potentially sensitive patterns
    return text
      .replace(/password[\s]*[:=][\s]*[^\s]+/gi, 'password: [REDACTED]')
      .replace(/secret[\s]*[:=][\s]*[^\s]+/gi, 'secret: [REDACTED]')
      .replace(/token[\s]*[:=][\s]*[^\s]+/gi, 'token: [REDACTED]')
      .replace(/key[\s]*[:=][\s]*[^\s]+/gi, 'key: [REDACTED]')
      .replace(/authorization[\s]*[:=][\s]*[^\s]+/gi, 'authorization: [REDACTED]')
      .replace(/bearer[\s]+[^\s]+/gi, 'bearer [REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]');
  }
}