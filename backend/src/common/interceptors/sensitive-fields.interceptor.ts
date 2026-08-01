import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

export function stripSensitiveFields(value: any): any {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'passwordHash')
      .map(([key, child]) => [key, stripSensitiveFields(child)]),
  );
}

@Injectable()
export class SensitiveFieldsInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(stripSensitiveFields));
  }
}
