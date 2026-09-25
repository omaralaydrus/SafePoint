import { NextRequest, NextResponse } from 'next/server';
import { SandboxRequestError, sandboxGet } from '@core/http/sandbox.gateway';
const ALLOWED = new Set(['ping', 'zones', 'license-types', 'business-activities', 'statistics']);
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const target = path.join('/');
  if (!ALLOWED.has(target)) return NextResponse.json({ message: 'Unknown sandbox resource.' }, { status: 404 });
  const query = new URLSearchParams();
  for (const key of ['offset', 'limit']) {
    const raw = request.nextUrl.searchParams.get(key);
    if (raw !== null) {
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || (key === 'limit' && Number(raw) < 1)) return NextResponse.json({ message: 'Invalid pagination.' }, { status: 400 });
      query.set(key, String(key === 'limit' ? Math.min(200, Number(raw)) : Number(raw)));
    }
  }
  try {
    return NextResponse.json(await sandboxGet(target, query.size ? `?${query}` : ''), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SandboxRequestError) {
      const retry = error.retryAfterSeconds && Number.isFinite(error.retryAfterSeconds) ? Math.max(1, Math.ceil(error.retryAfterSeconds)) : 60;
      return NextResponse.json({ message: error.message, code: error.code, retryAfterSeconds: retry }, { status: error.status, headers: error.status === 429 ? { 'Retry-After': String(retry) } : {} });
    }
    return NextResponse.json({ message: 'Council information is temporarily unavailable. Emergency calls and nearby search are still available.' }, { status: 503 });
  }
}
