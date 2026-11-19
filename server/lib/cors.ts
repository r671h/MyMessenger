import type { CorsOptions } from 'cors';
import { HttpError } from './validation';

/**
 * Only exact, explicitly configured origins may send credentialed requests.
 * Requests without an Origin header (curl, health checks, same-origin) are allowed.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

export function createCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
      callback(new HttpError(403, `Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  };
}
