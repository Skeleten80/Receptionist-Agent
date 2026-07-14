export type ErrorCode =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "PROVIDER"
  | "RETRYABLE"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; details?: unknown; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status =
      options?.status ??
      (
        {
          VALIDATION: 400,
          AUTHENTICATION: 401,
          AUTHORIZATION: 403,
          NOT_FOUND: 404,
          CONFLICT: 409,
          RATE_LIMIT: 429,
          PROVIDER: 502,
          RETRYABLE: 503,
          INTERNAL: 500,
        } as const
      )[code];
    this.details = options?.details;
    this.retryable = options?.retryable ?? code === "RETRYABLE";
  }
}

export function toErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? undefined,
        },
      },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "An unexpected error occurred." } },
  };
}
