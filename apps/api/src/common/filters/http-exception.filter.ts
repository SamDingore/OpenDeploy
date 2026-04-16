import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { failure } from '@opendeploy/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body && 'message' in body) {
        const m = (body as { message?: string | string[] }).message;
        message = Array.isArray(m) ? m.join(', ') : (m ?? message);
      }
      code = status === HttpStatus.NOT_FOUND ? 'not_found' : 'http_error';
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
    }

    res.status(status).json(failure(code, message));
  }
}
