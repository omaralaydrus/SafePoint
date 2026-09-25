import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, normalizePlaces, phoneHref, validCoordinates, directionsUrl } from '../src/shared/services/places.utils';
import { emergencyReducer, setLocation } from '../src/modules/emergency/store/emergency.reducer';
import { loadNearby } from '../src/modules/emergency/store/emergency.effect';
import { DEFAULT_LOCATION } from '../src/shared/models/emergency.model';

test('distance calculation is symmetric and uses kilometres', () => {
  assert.equal(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.195) < .01);
  assert.equal(distanceKm({ lat: 3, lon: 101 }, { lat: 4, lon: 102 }), distanceKm({ lat: 4, lon: 102 }, { lat: 3, lon: 101 }));
});
test('coordinates reject non-finite and out of bounds values', () => {
  for (const [lat, lon] of [[NaN, 101], [91, 100], [3, 181], [Infinity, 100]]) assert.equal(validCoordinates(lat, lon), false);
  assert.equal(validCoordinates(-90, -180), true);
});
test('telephone links exclude URL schemes and extra dial characters', () => {
  assert.equal(phoneHref('+60 (3) 1234-5678'), 'tel:+60312345678');
  assert.equal(phoneHref('999'), 'tel:999');
  assert.equal(phoneHref('03 1234 5678;03 8888 9999'), 'tel:0312345678');
  for (const phone of ['javascript:alert(1)', '123#456', '++60123456', 'call me', '', '12']) assert.equal(phoneHref(phone), undefined);
});
test('OSM normalization accepts centres, preserves unknown hours and emergency availability, and sorts by distance', () => {
  const origin = { lat: 3, lon: 101 };
  const places = normalizePlaces([
    { type: 'way', id: 1, center: { lat: 3.01, lon: 101 }, tags: { name: 'Test hospital', amenity: 'hospital' } },
    { type: 'node', id: 2, lat: 3.005, lon: 101, tags: { name: 'Test police', amenity: 'police', opening_hours: '24/7' } },
    { type: 'node', id: 3, lat: 10, lon: 101, tags: { name: 'Too far', amenity: 'pharmacy' } },
    { type: 'node', id: 4, lat: 3, lon: 101, tags: { amenity: 'pharmacy' } },
    { type: 'node', id: 5, lat: 3, lon: 101, tags: { name: 'Wrong type', amenity: 'cafe' } },
    { type: 'way', id: 6, center: { lat: 3.01, lon: 101 }, tags: { name: 'Test hospital', healthcare: 'hospital' } },
  ], origin, 5);
  assert.equal(places.length, 2); assert.equal(places[0].name, 'Test police');
  assert.equal(places[1].openingHours, undefined); assert.equal(places[1].emergency, undefined);
  assert.equal(places[1].address, 'Address not listed');
  assert.equal(directionsUrl(places[0]), 'https://www.google.com/maps/dir/?api=1&destination=3.005,101');
});
test('late requests cannot overwrite the new search area', () => {
  const args = { location: DEFAULT_LOCATION, radius: 5 };
  let state = emergencyReducer(undefined, loadNearby.pending('first', args));
  state = emergencyReducer(state, setLocation({ lat: 4, lon: 102, label: 'New area', source: 'manual' }));
  state = emergencyReducer(state, loadNearby.pending('second', args));
  state = emergencyReducer(state, loadNearby.fulfilled({ places: [], fetchedAt: 'old', source: 'OpenStreetMap', radiusKm: 5 }, 'first', args));
  assert.equal(state.status, 'loading'); assert.equal(state.fetchedAt, undefined);
  state = emergencyReducer(state, loadNearby.fulfilled({ places: [], fetchedAt: 'new', source: 'OpenStreetMap', radiusKm: 5 }, 'second', args));
  assert.equal(state.status, 'ready'); assert.equal(state.fetchedAt, 'new');
});
