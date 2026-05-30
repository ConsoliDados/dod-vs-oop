import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common'
import type { Response } from 'express'
import { DomainError } from '../../../core/errors'
import { UseCaseError } from '../../../core/use-cases/use-case'

interface ErrorBody {
  code: string
  message: string
  fields?: Array<{ property: string; error: string }>
}

/**
 * Maps thrown errors to the SRS error shape `{ code, message, fields? }`
 * (SRS §5.2, NFR-OBS-001):
 * - `DomainError` (invalid VO / entity / identifier) → 422 with per-field `fields`.
 * - `UseCaseError` with a `*_NOT_FOUND` code → 404; other application errors → 422.
 * - `HttpException` (framework) → its own status.
 * - anything else → 500.
 *
 * Lives in `shared/` so every bounded context reuses it (ADR-0002, throw-based).
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const { status, body } = this.toHttp(exception)
    response.status(status).json(body)
  }

  private toHttp(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      const fields = exception
        .toFlatErrors()
        .map((flat) => ({ property: flat.property, error: flat.message }))
      return { status: 422, body: { code: 'VALIDATION_ERROR', message: exception.message, fields } }
    }
    if (exception instanceof UseCaseError) {
      const status = exception.code.endsWith('_NOT_FOUND') ? 404 : 422
      return { status, body: { code: exception.code, message: exception.message } }
    }
    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        body: { code: 'HTTP_ERROR', message: exception.message },
      }
    }
    return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }
  }
}
