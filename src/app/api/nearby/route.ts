import { NextRequest, NextResponse } from 'next/server';
import { normalizePlaces, validCoordinates, type OsmElement } from '@shared/services/places.utils';
import type { NearbyResponse } from '@shared/models/emergency.model';

export const runtime = 'nodejs';
const cache = new Map<string, { expires: number; data: NearbyResponse }>();
const pending = new Map<string, Promise<NearbyResponse>>();
const MAX_CACHE = 100;

async function queryPlaces(lat: number, lon: number, radiusKm: number): Promise<NearbyResponse> {
  const query = `[out:json][timeout:20];(nwr["amenity"~"^(hospital|police|fire_station|pharmacy)$"](around:${radiusKm * 1000},${lat},${lon});nwr["healthcare"="hospital"](around:${radiusKm * 1000},${lat},${lon}););out center tags;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: new URLSearchParams({ data: query }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'SafePoint/1.0 (emergency facility directory)' },
    signal: AbortSignal.timeout(25000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Places service unavailable');
  const body = await response.json() as { elements?: OsmElement[]; remark?: string };
  // Overpass can return HTTP 200 with a timeout and incomplete results.
  if (!Array.isArray(body.elements) || body.remark) throw new Error('Places response incomplete');
  return { places: normalizePlaces(body.elements, { lat, lon }, radiusKm), fetchedAt: new Date().toISOString(), source: 'OpenStreetMap', radiusKm };
}
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latRaw = params.get('lat'), lonRaw = params.get('lon');
  const lat = Number(latRaw), lon = Number(lonRaw), radius = Number(params.get('radius') ?? '5');
  if (!latRaw?.trim() || !lonRaw?.trim() || !validCoordinates(lat, lon) || ![2, 5, 10, 20].includes(radius)) {
    return NextResponse.json({ message: 'Provide valid latitude, longitude and a radius of 2, 5, 10 or 20 km.' }, { status: 400 });
  }
  // Round the actual query and cache key together; this avoids leaking another user's exact position.
  const queryLat = Number(lat.toFixed(4)), queryLon = Number(lon.toFixed(4));
  const key = `${queryLat}:${queryLon}:${radius}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.data, { headers: { 'Cache-Control': 'private, no-store' } });
  if (pending.size >= 8 && !pending.has(key)) return NextResponse.json({ message: 'Place search is busy. Please try again shortly.' }, { status: 503, headers: { 'Retry-After': '15' } });
  try {
    if (!pending.has(key)) pending.set(key, queryPlaces(queryLat, queryLon, radius).then(data => {
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 300000, data });
      return data;
    }).finally(() => pending.delete(key)));
    return NextResponse.json(await pending.get(key), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ message: 'The nearby places service is unavailable. Retry, or search in Google Maps below. Emergency calling is still available.' }, { status: 503 });
  }
}
