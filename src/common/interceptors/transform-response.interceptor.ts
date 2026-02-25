import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply } from 'fastify';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { ApiResponseDto } from '../dto/api-response.dto';
import { PaginationMetaDto } from '../dto/paginated-response.dto';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponseDto<T>>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Success';

    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<FastifyReply>();

    return next.handle().pipe(
      map((data) => {
        // Skip wrapping if Fastify already sent the response (e.g. file streaming)
        if (response.sent) {
          return data;
        }

        const statusCode = response.statusCode;

        // Detect paginated payload: has an array `data` field + `meta` object
        if (
          data !== null &&
          data !== undefined &&
          typeof data === 'object' &&
          Array.isArray((data as any).data) &&
          (data as any).meta &&
          typeof (data as any).meta === 'object'
        ) {
          return ApiResponseDto.paginated<T>(
            (data as any).data,
            (data as any).meta as PaginationMetaDto,
            message,
            statusCode,
          ) as unknown as ApiResponseDto<T>;
        }

        return ApiResponseDto.success<T>(data, message, statusCode);
      }),
    );
  }
}
