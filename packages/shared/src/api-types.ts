/** Consistent API envelope for JSON responses */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiErrorBody;

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function failure(code: string, message: string): ApiErrorBody {
  return { ok: false, error: { code, message } };
}
