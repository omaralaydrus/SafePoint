/**
 * The browser-side half of the interceptor chain — the analogue of Angular's
 * injected `HttpClient`. Feature services depend on this and nothing else, so
 * swapping transport (or pointing at a mock) is a one-file change.
 *
 * Note the base path: `/api/sandbox` on THIS app's origin, not the license
 * host. Requests are completed by the route handler, which holds the token.
 */

export interface HttpFailure {
    status: number;
    code?: string;
    retryAfterSeconds?: number;
    message: string;
}

/**
 * Thrown for any non-2xx. Feature effects catch this and translate it into a
 * `…Failure` action, exactly as the Angular effects' `catchError` does.
 */
export class HttpError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly retryAfterSeconds?: number;

    constructor(failure: HttpFailure) {
        super(failure.message);
        this.name = 'HttpError';
        this.status = failure.status;
        this.code = failure.code;
        this.retryAfterSeconds = failure.retryAfterSeconds;
    }
}

const BASE = '/api/sandbox';

export interface PageQuery {
    /** Index of the first row to return (0-based). */
    offset?: number;
    /** Rows to return; the backend clamps anything above 200. */
    limit?: number;
}

function queryString(query?: PageQuery): string {
    if (!query) return '';
    const params = new URLSearchParams();
    if (query.offset !== undefined) params.set('offset', String(query.offset));
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    return params.size > 0 ? `?${params}` : '';
}

export async function httpGet<T>(path: string, query?: PageQuery): Promise<T> {
    const response = await fetch(`${BASE}/${path}${queryString(query)}`, {
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as Partial<HttpFailure>;
        throw new HttpError({
            status: response.status,
            code: body.code,
            retryAfterSeconds: body.retryAfterSeconds,
            message: body.message ?? `Request failed with HTTP ${response.status}.`,
        });
    }

    return (await response.json()) as T;
}
