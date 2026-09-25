/**
 * Cross-feature sandbox types — the analogue of Angular's `shared/models/`.
 * Anything used by more than one feature module lives here; anything used by
 * exactly one lives in that feature's own `*.model.ts`.
 */

/** Mirrors `SandboxPingVo`. The smoke test every integration should call first. */
export interface SandboxPing {
    /** Application id of the app answering — `license` here. */
    app: string;
    /** The authenticated principal, i.e. the sandbox username. */
    principal: string;
    /** Always true for a sandbox principal; a staff token cannot reach this endpoint. */
    sandbox: boolean;
    /** ISO-8601 instant at which the current token stops being accepted. */
    tokenExpiresAt: string;
    /** Calls allowed per minute for this credential. */
    rateLimitPerMinute: number;
    /** Calls still available in the current minute. */
    rateLimitRemaining: number;
    /** Path of the OpenAPI document describing this surface. */
    spec: string;
}

/** Shown instead of a raw error when the sandbox returns its rate-limit code. */
export const SANDBOX_RATE_LIMITED_LABEL = 'Rate limit reached';

/**
 * Documented paging defaults, restated so callers do not hardcode them.
 * `MAX_LIMIT` is the server's clamp: asking for more is not an error, it is
 * simply capped.
 */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
