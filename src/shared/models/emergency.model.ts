export type PlaceCategory = 'hospital' | 'police' | 'fire_station' | 'pharmacy';
export type CategoryFilter = 'all' | PlaceCategory;
export interface Coordinates { lat: number; lon: number }
export interface SearchLocation extends Coordinates { label: string; source: 'default' | 'device' | 'manual' }
export interface EmergencyPlace extends Coordinates {
  id: string; name: string; category: PlaceCategory; address: string;
  phone?: string; openingHours?: string; emergency?: string; distanceKm: number;
}
export interface NearbyResponse {
  places: EmergencyPlace[]; fetchedAt: string; source: 'OpenStreetMap'; radiusKm: number;
}
export interface PersonalContact { id: string; name: string; phone: string; relationship: string }
export const DEFAULT_LOCATION: SearchLocation = { lat: 3.1517, lon: 101.6943, label: 'Kuala Lumpur city centre', source: 'default' };
export const CATEGORIES: { id: CategoryFilter; label: string; singular: string }[] = [
  { id: 'all', label: 'All services', singular: 'All services' },
  { id: 'hospital', label: 'Hospitals', singular: 'Hospital' },
  { id: 'police', label: 'Police stations', singular: 'Police station' },
  { id: 'fire_station', label: 'Fire & rescue', singular: 'Fire station' },
  { id: 'pharmacy', label: 'Pharmacies', singular: 'Pharmacy' },
];
