import 'server-only';
import { SANDBOX_API_PREFIX, SANDBOX_RATE_LIMITED } from '@core/auth/auth.constant';
import { getAccessToken, invalidateToken } from '@core/auth/token.service';

/**
 * Server-side equivalent of the Angular console's HTTP interceptor chain
 * (`src/app/interceptors/`): attaches the bearer token, retries once on 401
 * after re-minting, and honours the sandbox's documented 429 contract.
 *
 * Everything the browser asks for passes through here. The browser's own
 * fetches go to `/api/sandbox/*` on this app's origin, never to the license
 * host, so the credential stays server-side and CORS never enters into it.
 */

export interface SandboxError {
    status: number;
    code?: string;
    message: string;
    retryAfterSeconds?: number;
}

export class SandboxRequestError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly retryAfterSeconds?: number;

    constructor(error: SandboxError) {
        super(error.message);
        this.name = 'SandboxRequestError';
        this.status = error.status;
        this.code = error.code;
        this.retryAfterSeconds = error.retryAfterSeconds;
    }
}

/** Rate-limit body shape, per the spec's tag description. */
interface RateLimitBody {
    code?: string;
    retryAfterSeconds?: number;
}

async function call(path: string, search: string, token: string): Promise<Response> {
    return fetch(`${SANDBOX_API_PREFIX}/${path}${search}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
    });
}

/**
 * GETs one sandbox path (e.g. `zones`, `statistics`) and returns the parsed body.
 *
 * `429` is surfaced rather than retried in place: the documented budget is
 * per-credential-per-minute, so sleeping inside a request handler would just
 * hold a connection open for up to a minute. The UI shows the countdown and the
 * user (or the store) retries.
 */
export async function sandboxGet<T>(path: string, search = ''): Promise<T> {
    let token = await getAccessToken();
    let response = await call(path, search, token);

    if (response.status === 401) {
        // Token expired early or was revoked. One retry with a fresh token;
        // if it fails again the credential itself is dead.
        invalidateToken();
        token = await getAccessToken();
        response = await call(path, search, token);
    }

    if (response.status === 429) {
        const body = (await response.json().catch(() => ({}))) as RateLimitBody;
        const headerValue = response.headers.get('Retry-After');
        const headerRetry = headerValue === null ? NaN : Number(headerValue);
        throw new SandboxRequestError({
            status: 429,
            code: body.code ?? SANDBOX_RATE_LIMITED,
            retryAfterSeconds: body.retryAfterSeconds ?? (Number.isFinite(headerRetry) ? headerRetry : undefined),
            message: 'Rate limit reached for this sandbox credential.',
        });
    }

    if (response.status === 403) {
        throw new SandboxRequestError({
            status: 403,
            message:
                'Forbidden. A sandbox credential reaches /api/sandbox/** and nothing else — ' +
                'check the path, and never substitute a staff token.',
        });
    }

    if (!response.ok) {
        throw new SandboxRequestError({
            status: response.status,
            message: `Sandbox request failed with HTTP ${response.status}.`,
        });
    }

    return (await response.json()) as T;
}
