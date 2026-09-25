import 'server-only';

/**
 * Sandbox connection constants, mirroring the Angular console's
 * `core/auth/auth.constant.ts`.
 *
 * `server-only` is load-bearing: importing this from a client component is a
 * build error, which is how the credential is kept out of the browser bundle.
 * The kernel URLs (`/oauth/token`, `/api/sandbox/**`, `/v3/api-docs/sandbox`)
 * are identical in every Rebana app by design — a developer moving between
 * apps gets the same onboarding everywhere.
 */

function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing ${name}. Copy .env.example to .env.local and fill in the sandbox ` +
            `credential from Tetapan > Sandbox Pembangun.`,
        );
    }
    return value;
}

export const SANDBOX_BASE_URL = (process.env.SANDBOX_BASE_URL ?? 'https://rebana.canang.com.my/rebana-license').replace(/\/$/, '');

export const TOKEN_URL = `${SANDBOX_BASE_URL}/oauth/token`;
export const SANDBOX_API_PREFIX = `${SANDBOX_BASE_URL}/api/sandbox`;
export const SPEC_URL = `${SANDBOX_BASE_URL}/v3/api-docs/sandbox`;

export const credentials = () => ({
    clientId: required('SANDBOX_CLIENT_ID'),
    clientSecret: required('SANDBOX_CLIENT_SECRET'),
    username: required('SANDBOX_USERNAME'),
    password: required('SANDBOX_PASSWORD'),
});

/**
 * Error code the backend returns on rate limiting. Match on this, never on the
 * prose message — the message is not a contract, the code is.
 */
export const SANDBOX_RATE_LIMITED = 'SANDBOX_RATE_LIMITED';

/** Refresh this many seconds before the token's own expiry, to avoid racing it. */
export const TOKEN_REFRESH_SKEW_SECONDS = 60;
