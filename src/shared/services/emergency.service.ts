import type { NearbyResponse, SearchLocation } from '@shared/models/emergency.model';
export async function findNearby(location: SearchLocation, radiusKm: number, signal?: AbortSignal): Promise<NearbyResponse> {
  const query = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon), radius: String(radiusKm) });
  const response = await fetch(`/api/nearby?${query}`, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Nearby places could not be loaded. Please try again.');
  return body;
}
