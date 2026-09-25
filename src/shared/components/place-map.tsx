'use client';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, MapPinned } from 'lucide-react';
import type { EmergencyPlace, SearchLocation } from '@shared/models/emergency.model';
import { CATEGORIES } from '@shared/models/emergency.model';
import { directionsUrl } from '@shared/services/places.utils';
const symbols = { hospital: '+', police: 'P', fire_station: 'F', pharmacy: 'Rx' };
export default function PlaceMap({ places, location, selected, onSelect }: { places: EmergencyPlace[]; location: SearchLocation; selected: string | null; onSelect: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), markers = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!root.current) return;
    const instance = L.map(root.current, { zoomControl: false, scrollWheelZoom: false }).setView([location.lat, location.lon], 14);
    map.current = instance;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 });
    tiles.on('tileerror', () => setTileError(true));
    tiles.addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize()); observer.observe(root.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
    // The map instance lives for this component's lifetime; layers update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { map.current?.setView([location.lat, location.lon], 14); }, [location.lat, location.lon]);
  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers();
    L.marker([location.lat, location.lon], { icon: L.divIcon({ className: 'origin-marker', html: '<span></span>', iconSize: [22, 22] }) })
      .bindTooltip(location.source === 'device' ? 'Your device location' : 'Search centre').addTo(markers.current);
    for (const place of places) {
      const marker = L.marker([place.lat, place.lon], { icon: L.divIcon({ className: `place-marker ${place.category} ${selected === place.id ? 'selected' : ''}`, html: `<span>${symbols[place.category]}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] }) });
      const popup = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = place.name;
      const detail = document.createElement('p'); detail.textContent = `${CATEGORIES.find(c => c.id === place.category)?.singular} · ${place.distanceKm.toFixed(1)} km in a straight line`;
      const link = document.createElement('a'); link.href = directionsUrl(place); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Get directions ↗';
      popup.append(title, detail, link); marker.bindPopup(popup).on('click', () => onSelect(place.id)).addTo(markers.current);
      if (selected === place.id) { marker.openPopup(); map.current?.panTo([place.lat, place.lon]); }
    }
  }, [places, location, selected, onSelect]);
  return <div className="map-panel"><div ref={root} className="leaflet-map" role="region" aria-label="Map of nearby emergency facilities" />
    <div className="map-top-tag"><span className="live-dot" /> Your search area <span className="map-tag-divider" /> <MapPinned size={14} /> OpenStreetMap</div>
    <button className="map-recenter icon-button" onClick={() => map.current?.setView([location.lat, location.lon], 14)} aria-label="Recenter map"><LocateFixed size={19} /></button>
    {tileError && <div className="map-error">Map tiles unavailable. Use the facility list for directions.</div>}
    <div className="map-legend"><span><i className="legend-dot hospital" />Hospital</span><span><i className="legend-dot police" />Police</span><span><i className="legend-dot fire_station" />Fire & rescue</span><span><i className="legend-dot pharmacy" />Pharmacy</span></div>
  </div>;
}
