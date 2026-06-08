import type { logger } from "@ddd-dod/platform";
import { Elysia } from "elysia";

/** Stable error envelope (SRS NFR-OBS-001). `requestId` is best-effort. */
export interface ErrorEnvelope {
  readonly error: { readonly code: string; readonly message: string };
  readonly requestId?: string;
}

/** Elysia error code → HTTP status + stable client-facing code. */
const MAPPED: Record<string, { status: number; code: string }> = {
  NOT_FOUND: { status: 404, code: "not-found" },
  VALIDATION: { status: 422, code: "validation" },
  PARSE: { status: 400, code: "bad-request" },
};

const envelope = (code: string, message: string, requestId: string | undefined): ErrorEnvelope =>
  requestId ? { error: { code, message }, requestId } : { error: { code, message } };

/**
 * Global error boundary mounted once at the app root. Maps Elysia's error codes
 * to a stable JSON envelope + correct status: 404/422/400 surface the framework
 * message; anything else is a **500** logged with the request id (the real cause
 * never leaks to the client). The request id is read from the `x-request-id`
 * header the `setup` derive sets, so it correlates the log with the response.
 */
export function errorEnvelope(log: logger.AppLogger) {
  return new Elysia({ name: "error-envelope" }).onError(
    { as: "global" },
    ({ code, error, set }) => {
      const header = set.headers["x-request-id"];
      const requestId = typeof header === "string" ? header : undefined;

      const mapped = MAPPED[String(code)];
      if (mapped) {
        set.status = mapped.status;
        const message = error instanceof Error ? error.message : String(code);
        return envelope(mapped.code, message, requestId);
      }

      set.status = 500;
      log.error("unhandled request error", error, { code: String(code), requestId });
      return envelope("internal-error", "internal server error", requestId);
    },
  );
}
