import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        const extracted = (errorResponse as Record<string, unknown>).message;
        if (Array.isArray(extracted)) {
          message = extracted.join(', ');
        } else if (typeof extracted === 'string') {
          message = extracted;
        }
      }
      this.logger.warn(`[HTTP ${status}] ${message}`);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack ?? exception.message);
    } else {
      message = String(exception);
      this.logger.error(message);
    }

    response.status(status).json({
      status: 'error',
      message,
      code: status,
    });
  }
}
