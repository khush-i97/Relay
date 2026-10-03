import { API_ERROR_STATUS, type ApiError, type ApiErrorCode } from "../../shared/contracts";

export class ApiProblem extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, options: { retryable?: boolean; details?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "ApiProblem";
    this.code = code;
    this.status = API_ERROR_STATUS[code];
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
