import 'server-only';
import { TOKEN_URL, TOKEN_REFRESH_SKEW_SECONDS, credentials } from './auth.constant';

/**
 * Password-grant token broker. The Angular console keeps its token in an
 * NgRx-backed auth service in the browser; here the equivalent lives on the
 * server only, because the sandbox credential must never reach a client bundle.
 *
 * One token is cached per server process and reused until it is close to
 * expiry. Concurrent callers share a single in-flight request rather than
 * stampeding `/oauth/token` — a cold page with four panels would otherwise mint
 * four tokens.
 */

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface CachedToken {
    accessToken: string;
    /** Epoch millis after which the token should be re-minted. */
    expiresAt: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

async function mint(): Promise<CachedToken> {
    const { clientId, clientSecret, username, password } = credentials();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'password', username, password }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
        // Deliberately does not echo the response body: on a bad grant it can
        // carry back fragments of what was sent.
        throw new Error(
            `Token request failed with HTTP ${response.status}. Check the four values in ` +
            `.env.local against Tetapan > Sandbox Pembangun; a rotation invalidates the old pair.`,
        );
    }

    const body = (await response.json()) as TokenResponse;
    if (!body.access_token || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
        throw new Error('The sandbox returned an invalid authentication response.');
    }
    return {
        accessToken: body.access_token,
        expiresAt: Date.now() + Math.max(0, body.expires_in - TOKEN_REFRESH_SKEW_SECONDS) * 1000,
    };
}

export async function getAccessToken(): Promise<string> {
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

    inFlight ??= mint()
        .then(token => {
            cached = token;
            return token;
        })
        .finally(() => {
            inFlight = null;
        });

    return (await inFlight).accessToken;
}

/**
 * Drops the cached token so the next call mints a fresh one. Called when the
 * sandbox answers 401 — the token was revoked or expired early. Revocation is
 * instant server-side (authorities reload per request), so a locked credential
 * fails here rather than silently serving stale data.
 */
export function invalidateToken(): void {
    cached = null;
}
