import type { Coordinates, EmergencyPlace, PlaceCategory } from '@shared/models/emergency.model';

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function validCoordinates(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
export function phoneHref(phone?: string): string | undefined {
  if (!phone) return;
  const first = phone.split(';')[0].trim();
  if (!/^\+?[\d\s().-]+$/.test(first)) return;
  const clean = first.replace(/[^\d+]/g, '');
  if (clean.replace(/\D/g, '').length < 3) return;
  return `tel:${clean}`;
}
export function directionsUrl(place: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
}
export interface OsmElement {
  type: string; id: number; lat?: number; lon?: number; center?: Coordinates; tags?: Record<string, string>;
}
export function normalizePlaces(elements: OsmElement[], origin: Coordinates, radiusKm: number): EmergencyPlace[] {
  const places: EmergencyPlace[] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat, lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined || !validCoordinates(lat, lon)) continue;
    const category = (tags.amenity === 'hospital' || tags.healthcare === 'hospital' ? 'hospital' : tags.amenity) as PlaceCategory;
    if (!['hospital', 'police', 'fire_station', 'pharmacy'].includes(category)) continue;
    const name = tags['name:en'] || tags.name;
    if (!name) continue;
    const distance = distanceKm(origin, { lat, lon });
    if (distance > radiusKm) continue;
    const key = `${category}:${name.toLowerCase()}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `${element.type}/${element.id}`, name, category, lat, lon, distanceKm: distance,
      address: tags['addr:full'] || [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ') || 'Address not listed',
      phone: tags.phone || tags['contact:phone'], openingHours: tags.opening_hours, emergency: tags.emergency,
    });
  }
  return places.sort((a, b) => a.distanceKm - b.distanceKm);
}
