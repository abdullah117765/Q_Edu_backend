import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { status: string; data: T | null }> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<{ status: string; data: T | null }> {
    return next.handle().pipe(
      map((data) => ({
        status: 'success',
        data: data ?? null,
      })),
    );
  }
}
