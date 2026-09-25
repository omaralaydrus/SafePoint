import type { NextConfig } from 'next';

/**
 * Nothing here proxies to the sandbox: the browser never talks to it directly.
 * Every sandbox call goes through the route handler at `/api/sandbox/[...path]`,
 * which is the only place the credential exists. See README §Security.
 */
const nextConfig: NextConfig = {
    reactStrictMode: true,
    devIndicators: false,
    async headers() {
        return [{ source: '/:path*', headers: [
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        ] }];
    },
};

export default nextConfig;
