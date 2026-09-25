'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Activity, ArrowDownWideNarrow, ArrowRight, ArrowUpRight, BellRing, Bookmark, Building2, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Cross, ExternalLink, Flame, Heart, HeartHandshake, Hospital, LayoutGrid, LocateFixed, MapPin, MapPinned, Menu, Navigation, Phone, Plus, Radio, RefreshCw, Search, Share2, Shield, ShieldCheck, Siren, SlidersHorizontal, Trash2, Users, WifiOff, X, type LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { loadNearby } from '../store/emergency.effect';
import { setCategory, setLocation, setRadius } from '../store/emergency.reducer';
import { CATEGORIES, DEFAULT_LOCATION, type CategoryFilter, type EmergencyPlace, type PersonalContact, type SearchLocation } from '@shared/models/emergency.model';
import { directionsUrl, distanceKm, phoneHref, validCoordinates } from '@shared/services/places.utils';
import { findAllZones } from '@shared/services/zone.service';
import { HttpError } from '@core/http/http.client';
import type { Zone } from '@shared/models/zone.model';
import { Dialog } from '@shared/components/dialog';

const PlaceMap = dynamic(() => import('@shared/components/place-map'), { ssr: false, loading: () => <div className="map-loading"><MapPinned size={32} /><span>Loading your map…</span></div> });
const categoryIcons: Record<CategoryFilter, LucideIcon> = { all: LayoutGrid, hospital: Hospital, police: Shield, fire_station: Flame, pharmacy: Cross };
type View = 'nearby' | 'saved' | 'contacts' | 'guide' | 'council';
const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'nearby', label: 'Emergency overview', icon: LayoutGrid },
  { id: 'saved', label: 'Saved places', icon: Bookmark },
  { id: 'contacts', label: 'My emergency contacts', icon: Users },
  { id: 'guide', label: 'Emergency guide', icon: HeartHandshake },
];
const cities: SearchLocation[] = [DEFAULT_LOCATION,
  { label: 'Petaling Jaya', lat: 3.1073, lon: 101.6067, source: 'manual' },
  { label: 'Shah Alam', lat: 3.0738, lon: 101.5183, source: 'manual' },
  { label: 'George Town, Penang', lat: 5.4141, lon: 100.3288, source: 'manual' },
  { label: 'Johor Bahru', lat: 1.4927, lon: 103.7414, source: 'manual' },
  { label: 'Kuching', lat: 1.5533, lon: 110.3592, source: 'manual' },
  { label: 'Kota Kinabalu', lat: 5.9804, lon: 116.0735, source: 'manual' },
];
function readStored<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed.filter(isValid) : []; } catch { return []; }
}
function isPlace(value: unknown): value is EmergencyPlace {
  if (!value || typeof value !== 'object') return false;
  const p = value as EmergencyPlace;
  return typeof p.id === 'string' && typeof p.name === 'string' && typeof p.address === 'string' && CATEGORIES.some(c => c.id !== 'all' && c.id === p.category) && validCoordinates(p.lat, p.lon) && (p.phone === undefined || typeof p.phone === 'string') && (p.openingHours === undefined || typeof p.openingHours === 'string');
}
function isContact(value: unknown): value is PersonalContact {
  if (!value || typeof value !== 'object') return false;
  const c = value as PersonalContact;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.phone === 'string' && typeof c.relationship === 'string' && !!phoneHref(c.phone);
}

export function EmergencyPage() {
  const dispatch = useAppDispatch();
  const { location, radius, category, places, status, error } = useAppSelector(s => s.emergency);
  const [view, setView] = useState<View>('nearby');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<EmergencyPlace[]>([]);
  const [contacts, setContacts] = useState<PersonalContact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<'location' | 'contact' | 'share' | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [online, setOnline] = useState(true);
  const [display, setDisplay] = useState<'split' | 'list'>('split');
  const [sort, setSort] = useState<'distance' | 'name'>('distance');
  const [formError, setFormError] = useState('');
  const [shareLocation, setShareLocation] = useState<SearchLocation | null>(null);
  useEffect(() => {
    setSaved(readStored('safepoint.saved', isPlace)); setContacts(readStored('safepoint.contacts', isContact));
    const update = () => setOnline(navigator.onLine); update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => { const task = dispatch(loadNearby({ location, radius })); return () => { task.abort(); }; }, [dispatch, location, radius]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const navigate = (next: View) => { setView(next); setQuery(''); setMenu(false); setSelected(null); };
  const onSelect = useCallback((id: string) => setSelected(id), []);
  const updateSaved = (place: EmergencyPlace) => {
    const exists = saved.some(p => p.id === place.id);
    const next = exists ? saved.filter(p => p.id !== place.id) : [...saved, place];
    setSaved(next);
    try { localStorage.setItem('safepoint.saved', JSON.stringify(next)); setNotice(exists ? 'Place removed from your saved places.' : 'Place saved on this device.'); } catch { setNotice('Saved for this session only. Your browser has blocked storage.'); }
  };
  const updateContacts = (next: PersonalContact[]) => {
    setContacts(next);
    try { localStorage.setItem('safepoint.contacts', JSON.stringify(next)); } catch { setNotice('Contact changes are saved for this session only. Browser storage is unavailable.'); }
  };
  const requestLocation = (share = false) => {
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('Location is not supported by this browser. Choose a city or enter coordinates.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const next: SearchLocation = { lat: position.coords.latitude, lon: position.coords.longitude, label: 'Your current location', source: 'device' };
      dispatch(setLocation(next)); setSelected(null); setLocating(false);
      if (share) { setShareLocation(next); setModal('share'); } else setModal(null);
    }, err => {
      setLocating(false);
      setLocationError(err.code === 1 ? 'Location permission was denied. Enable it in your browser, or choose a search area manually.' : 'Your location could not be found. Try again, or choose a search area manually.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  };
  const filtered = useMemo(() => {
    const list = view === 'saved' ? saved.map(p => ({ ...p, distanceKm: distanceKm(location, p) })) : places;
    return list.filter(p => (category === 'all' || p.category === category) && `${p.name} ${p.address}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : a.distanceKm - b.distanceKm);
  }, [view, saved, places, category, query, location, sort]);
  const chooseLocation = (next: SearchLocation) => { dispatch(setLocation(next)); setModal(null); setSelected(null); setLocationError(''); };
  const saveContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim(), phone = String(data.get('phone') || '').trim();
    if (!name || !phoneHref(phone) || phone.replace(/\D/g, '').length < 7) { setFormError('Enter a name and a valid contact phone number (at least 7 digits).'); return; }
    updateContacts([...contacts, { id: crypto.randomUUID(), name, phone, relationship: String(data.get('relationship') || 'Trusted contact') }]); setModal(null); setFormError('');
  };
  const submitCoordinates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), lat = Number(data.get('lat')), lon = Number(data.get('lon'));
    if (!validCoordinates(lat, lon)) { setFormError('Enter valid latitude (-90 to 90) and longitude (-180 to 180).'); return; }
    chooseLocation({ lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, source: 'manual' });
  };
  const shareText = shareLocation ? `Here is my location: https://www.google.com/maps/search/?api=1&query=${shareLocation.lat},${shareLocation.lon}` : '';
  const copyLocation = async () => {
    try { await navigator.clipboard.writeText(shareText); setNotice('Location link copied. Send it to someone you trust.'); } catch { setNotice('Copy is unavailable. Select and copy the location link in the box.'); }
  };
  const nativeShare = async () => {
    if (!navigator.share) return copyLocation();
    try { await navigator.share({ title: 'My location · SafePoint', text: shareText }); } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) setNotice('Sharing was unavailable. You can copy the link instead.'); }
  };

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to main content</a>
    {menu && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
      <button className="brand" onClick={() => navigate('nearby')} aria-label="SafePoint home"><span className="brand-symbol"><ShieldCheck size={27} strokeWidth={1.8} /></span><span>Safe<span className="brand-red">Point</span><small>HERE WHEN IT MATTERS</small></span></button>
      <div className="nav-label">YOUR SAFETY COMPANION</div>
      <nav aria-label="Main navigation">{navItems.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.id === 'saved' && saved.length > 0 && <span className="nav-count">{saved.length}</span>}{view === item.id && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="sidebar-divider" /><div className="nav-label">COMMUNITY</div>
      <button className={`nav-item ${view === 'council' ? 'active' : ''}`} onClick={() => navigate('council')} aria-current={view === 'council' ? 'page' : undefined}><Building2 size={19} /><span>Local council</span><ArrowUpRight size={14} /></button>
      <div className="sidebar-bottom"><div className="prepared-card"><span className="prepared-icon"><HeartHandshake size={24} /></span><h3>A little preparation.<br />A lot of peace of mind.</h3><p>Add someone you trust to your emergency contacts.</p><button onClick={() => navigate('contacts')}>Manage contacts <ArrowRight size={15} /></button></div><div className="country"><span className="country-mark">MY</span><div><strong>Made for Malaysia</strong><span>Help, within reach.</span></div><Heart size={15} /></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu size={21} /></button><ShieldCheck size={18} /><span>Your safety, first</span></div><div className="topbar-right"><span className="country-pill"><span className="live-dot" /> Malaysia</span><a className="top-call" href="tel:999"><Phone size={16} /> Emergency <strong>999</strong></a></div></header>
      {!online && <div className="offline-banner" role="status"><WifiOff size={17} /> You’re offline. Saved contacts remain available. Calls need phone service.</div>}
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><div className="eyebrow"><span /> ALWAYS WITHIN REACH</div><h1>{view === 'nearby' ? 'Help is closer than you think.' : view === 'saved' ? 'Your places. Ready when needed.' : view === 'contacts' ? 'Your people, one call away.' : view === 'guide' ? 'A calm moment. A clear next step.' : 'Connected to your community.'}</h1><p>{view === 'nearby' ? 'Find the right help, reach the right people, and feel a little safer.' : view === 'saved' ? 'Keep the places that matter close, wherever you are.' : view === 'contacts' ? 'Keep trusted family and friends within easy reach.' : view === 'guide' ? 'Simple reminders to help you contact emergency services.' : 'Explore local council zones with information from Rebana.'}</p></div><span className="reassurance"><ShieldCheck size={17} /> Your everyday safety companion</span></div>
        {view === 'nearby' && <>
          <div className="hero-grid"><section className="emergency-hero" aria-labelledby="emergency-title"><div className="hero-content"><div className="hero-kicker"><span className="hero-pulse" /> IN AN EMERGENCY?</div><h2 id="emergency-title">One number.<br />The help you need.</h2><p>Police, ambulance, fire & rescue.<br />Malaysia’s emergency services, 24/7.</p><a className="hero-call" href="tel:999"><Phone size={21} fill="currentColor" /><span>Call emergency <strong>999</strong></span><ArrowUpRight size={20} /></a><span className="hero-call-note">Opens your phone dialler · For emergencies only</span></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="hero-shield"><Shield size={142} strokeWidth={1} /><Plus size={57} strokeWidth={2.6} /></div><span className="art-cross one">+</span><span className="art-cross two">+</span><div className="art-heart"><Activity size={29} /></div><div className="art-badge"><ShieldCheck size={15} /> Here for you, around the clock</div></div></section>
          <section className="location-card"><div className="card-kicker"><span className="soft-icon"><LocateFixed size={20} /></span> YOUR SEARCH LOCATION <span className="status-tag">{location.source === 'device' ? 'Located' : 'Set area'}</span></div><h2>{location.label}</h2><p className="location-description">{location.source === 'default' ? 'Showing the city centre. Use your location to find help closest to you.' : location.source === 'device' ? 'Using your device’s last location fix. Refresh if you have moved.' : 'Showing facilities around your selected search area.'}</p><button className="location-button" onClick={() => requestLocation()} disabled={locating}><LocateFixed size={17} />{locating ? 'Finding your location…' : 'Use my current location'}<ArrowRight size={17} /></button><button className="text-button location-change" onClick={() => { setFormError(''); setModal('location'); }}>Choose another location <ChevronRight size={15} /></button><div className="location-private"><ShieldCheck size={13} /> Location is used only to find nearby help.</div></section></div>
          <section className="quick-services" aria-label="Quick emergency services">{[{ icon: Hospital, title: 'Medical emergency', subtitle: 'Ambulance & urgent care', cat: 'hospital' }, { icon: Shield, title: 'Police assistance', subtitle: 'Safety & protection', cat: 'police' }, { icon: Flame, title: 'Fire & rescue', subtitle: 'Fire & rescue services', cat: 'fire_station' }, { icon: Cross, title: 'Find a pharmacy', subtitle: 'Medicines & supplies', cat: 'pharmacy' }].map(service => <button key={service.cat} onClick={() => { dispatch(setCategory(service.cat as CategoryFilter)); document.getElementById('nearby')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span className={`service-icon ${service.cat}`}><service.icon size={23} /></span><span><strong>{service.title}</strong><small>{service.subtitle}</small></span><ChevronRight size={17} /></button>)}</section>
        </>}
        {locationError && <div className="inline-alert" role="alert"><MapPin size={18} /><span>{locationError}</span><button className="text-button" onClick={() => setModal('location')}>Choose area</button></div>}
        {(view === 'nearby' || view === 'saved') && <section className="nearby-section" id="nearby"><div className="section-heading"><div><h2>{view === 'saved' ? 'Saved places' : 'Help around you'} <span className="count-badge">{view === 'saved' ? saved.length : status === 'ready' ? places.length : '—'}</span></h2><p>{view === 'saved' ? 'Saved on this device. Facility details may have changed.' : 'Discover nearby services and the quickest way to get there.'}</p></div><div className="view-toggle" aria-label="Results layout"><button className={display === 'split' ? 'active' : ''} aria-pressed={display === 'split'} onClick={() => setDisplay('split')}><MapPinned size={16} />Map & list</button><button className={display === 'list' ? 'active' : ''} aria-pressed={display === 'list'} onClick={() => setDisplay('list')}><LayoutGrid size={16} />List</button></div></div>
          <div className="directory"><div className="directory-toolbar"><div className="category-tabs" aria-label="Facility category">{CATEGORIES.map(c => { const Icon = categoryIcons[c.id]; return <button key={c.id} aria-pressed={category === c.id} className={category === c.id ? 'active' : ''} onClick={() => { dispatch(setCategory(c.id)); setSelected(null); }}><Icon size={16} />{c.label}</button>; })}</div><label className="radius-control"><SlidersHorizontal size={15} /><span className="sr-only">Search radius</span><select value={radius} onChange={e => dispatch(setRadius(Number(e.target.value)))}>{[2, 5, 10, 20].map(r => <option value={r} key={r}>Within {r} km</option>)}</select></label></div>
            <div className={`results-layout ${display === 'list' ? 'list-only' : ''}`}><div className="results-column"><div className="results-search"><Search size={18} /><input aria-label="Search facilities" placeholder="Search a place or address…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</div><div className="results-meta"><span aria-live="polite">{status === 'loading' && view !== 'saved' ? 'Finding nearby help…' : `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} found`}</span><label><ArrowDownWideNarrow size={13} /><span className="sr-only">Sort places</span><select value={sort} onChange={e => setSort(e.target.value as 'distance' | 'name')}><option value="distance">Nearest first</option><option value="name">Name A–Z</option></select></label></div>
              <div className="place-list" aria-busy={status === 'loading' && view !== 'saved'}>
                {status === 'loading' && view !== 'saved' ? <div className="loading-results">{[1, 2, 3].map(n => <div className="skeleton-card" key={n}><span /><div /><div /><div /></div>)}<span className="sr-only" role="status">Loading nearby facilities</span></div> : status === 'error' && view !== 'saved' ? <div className="empty-state"><Radio size={30} /><h3>We couldn’t load nearby places</h3><p>{error}</p><button className="primary-button" onClick={() => dispatch(loadNearby({ location, radius }))}><RefreshCw size={16} />Try again</button><a className="text-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${category === 'all' ? 'emergency services' : CATEGORIES.find(c => c.id === category)?.label} near ${location.lat},${location.lon}`)}`} target="_blank" rel="noreferrer">Search Google Maps <ExternalLink size={14} /></a></div> : filtered.length === 0 ? <div className="empty-state"><MapPin size={32} /><h3>{view === 'saved' && !saved.length ? 'Your go-to places belong here' : 'No matching places found'}</h3><p>{view === 'saved' && !saved.length ? 'Tap the bookmark on a facility to keep its details handy.' : 'Try another category, clear your search, or widen your search area.'}</p>{view === 'saved' && !saved.length ? <button className="primary-button" onClick={() => navigate('nearby')}>Explore nearby places <ArrowRight size={15} /></button> : <button className="secondary-button" onClick={() => { setQuery(''); dispatch(setCategory('all')); if (view !== 'saved' && radius < 20) dispatch(setRadius([2, 5, 10, 20].find(value => value > radius) || 20)); }}>Reset filters{view !== 'saved' && radius < 20 ? ' & widen search' : ''}</button>}</div> : filtered.map(place => <PlaceCard key={place.id} place={place} selected={selected === place.id} saved={saved.some(p => p.id === place.id)} onSelect={() => setSelected(place.id)} onSave={() => updateSaved(place)} />)}
              </div><div className="data-note"><CircleHelp size={13} /><span>Distances are in a straight line. Hours and services may change.</span></div></div>
              {display === 'split' && <PlaceMap places={filtered} location={location} selected={selected} onSelect={onSelect} />}
            </div>
          </div><div className="directory-footnote"><span><MapPin size={13} /> Searching around {location.label}{location.source === 'default' ? ' (default area)' : ''}</span><span>Place data © OpenStreetMap contributors</span></div>
        </section>}
        {view === 'contacts' && <section className="secondary-panel"><div className="section-heading"><div><h2>My emergency contacts <span className="count-badge">{contacts.length}</span></h2><p>Stored only in this browser. Clearing browser data removes your contacts.</p></div><button className="primary-button" onClick={() => { setFormError(''); setModal('contact'); }}><Plus size={17} />Add a contact</button></div>{contacts.length ? <div className="contacts-grid">{contacts.map(contact => <article className="contact-card" key={contact.id}><div className="contact-avatar">{contact.name.slice(0, 1).toUpperCase()}</div><div className="contact-details"><h3>{contact.name}</h3><p>{contact.relationship}</p><span>{contact.phone}</span></div><a className="icon-button contact-call" href={phoneHref(contact.phone)} aria-label={`Call ${contact.name}`}><Phone size={20} /></a><button className="icon-button" aria-label={`Remove ${contact.name}`} onClick={() => updateContacts(contacts.filter(c => c.id !== contact.id))}><Trash2 size={17} /></button></article>)}</div> : <div className="large-empty"><span className="large-empty-icon"><Users size={35} /></span><h2>A familiar voice makes a difference.</h2><p>Add a family member, friend or neighbour you can reach when you need support.</p><button className="primary-button" onClick={() => { setFormError(''); setModal('contact'); }}><Plus size={17} />Add your first contact</button></div>}</section>}
        {view === 'guide' && <section className="guide-section"><div className="guide-call"><span className="soft-icon"><Phone size={24} /></span><div><h2>In immediate danger? Call 999.</h2><p>Ask for police, an ambulance, or fire and rescue. Follow the operator’s instructions.</p></div><a className="primary-button" href="tel:999"><Phone size={18} />Call 999</a></div><div className="guide-grid">{[{ number: '01', icon: MapPin, title: 'Know where you are', text: 'Give your address, a nearby landmark, and your location coordinates if needed. Use the location button to find your coordinates.' }, { number: '02', icon: Phone, title: 'Explain what happened', text: 'Tell the operator what help you need, how many people are affected, and your callback number. Answer their questions clearly.' }, { number: '03', icon: HeartHandshake, title: 'Stay on the line', text: 'Follow the emergency operator’s instructions. Tell them if the situation or your location changes.' }].map(item => <article className="guide-card" key={item.number}><div><item.icon size={24} /><span>{item.number}</span></div><h3>{item.title}</h3><p>{item.text}</p></article>)}</div><div className="guide-source"><ShieldCheck size={19} /><p>999 is Malaysia’s integrated emergency number. SafePoint helps you reach services; it does not dispatch responders or monitor emergencies.</p><a href="https://www.malaysia.gov.my/en/categories/safety-and-community/public-safety/mers-999-emergency-line" target="_blank" rel="noreferrer">Official 999 information <ExternalLink size={14} /></a></div></section>}
        {view === 'council' && <CouncilPanel />}
        <section className="share-strip"><span className="share-strip-icon"><Share2 size={22} /></span><div><h3>Let someone know where you are.</h3><p>A little connection can make all the difference.</p></div><button className="secondary-button" disabled={locating} onClick={() => requestLocation(true)}><Share2 size={16} />{locating ? 'Finding location…' : 'Share my location'}<ArrowUpRight size={15} /></button></section>
        <footer><span className="footer-brand"><ShieldCheck size={15} /> SafePoint <span>·</span> A little closer to help.</span><span>For emergencies in Malaysia, always call <a href="tel:999">999</a>.</span></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={18} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}
    {modal === 'location' && <Dialog title="Choose your search area" onClose={() => setModal(null)}><p className="dialog-description">Use your current location, choose a city, or enter coordinates. A selected city is a search centre, not your actual location.</p><button className="primary-button full-width" onClick={() => requestLocation()} disabled={locating}><LocateFixed size={18} />{locating ? 'Finding your location…' : 'Use my current location'}</button>{locationError && <p className="form-error" role="alert">{locationError}</p>}<div className="city-list">{cities.map(city => <button key={city.label} onClick={() => chooseLocation({ ...city, source: 'manual' })}><MapPin size={17} />{city.label}<ChevronRight size={15} /></button>)}</div><form onSubmit={submitCoordinates}><h3>Enter coordinates</h3><div className="form-row"><label>Latitude<input name="lat" type="number" step="any" min="-90" max="90" required placeholder="3.1517" /></label><label>Longitude<input name="lon" type="number" step="any" min="-180" max="180" required placeholder="101.6943" /></label></div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="secondary-button full-width" type="submit">Search this area <ArrowRight size={16} /></button></form></Dialog>}
    {modal === 'contact' && <Dialog title="Add an emergency contact" onClose={() => setModal(null)}><p className="dialog-description">Choose someone you trust. Contacts are stored on this device only.</p><form onSubmit={saveContact}><label>Full name<input name="name" autoComplete="name" required maxLength={80} placeholder="e.g. Aisha Rahman" /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" required maxLength={25} placeholder="e.g. +60 12 345 6789" /></label><label>Relationship<select name="relationship"><option>Family</option><option>Friend</option><option>Neighbour</option><option>Colleague</option><option>Trusted contact</option></select></label>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button full-width" type="submit"><Plus size={17} />Save contact</button></form></Dialog>}
    {modal === 'share' && shareLocation && <Dialog title="Share your current location" onClose={() => setModal(null)}><div className="share-coordinate"><MapPin size={29} /><strong>{shareLocation.lat.toFixed(5)}, {shareLocation.lon.toFixed(5)}</strong><span>Device location captured just now</span></div><p className="dialog-description">Send this link to someone you trust. This is a one-time location, not live tracking, and does not alert emergency services.</p><label>Location message<textarea readOnly value={shareText} rows={3} onFocus={e => e.target.select()} /></label><div className="dialog-actions"><button className="secondary-button" onClick={copyLocation}>Copy link</button><button className="primary-button" onClick={nativeShare}><Share2 size={16} />Share location</button></div></Dialog>}
  </div>;
}

function PlaceCard({ place, saved, selected, onSave, onSelect }: { place: EmergencyPlace; saved: boolean; selected: boolean; onSave: () => void; onSelect: () => void }) {
  const Icon = categoryIcons[place.category], phone = phoneHref(place.phone);
  return <article className={`place-card ${selected ? 'selected' : ''}`}><div className="place-card-top"><span className={`place-icon ${place.category}`}><Icon size={20} /></span><div className="place-name"><button onClick={onSelect}>{place.name}</button><span>{CATEGORIES.find(c => c.id === place.category)?.singular}</span></div><button className={`icon-button save-button ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Unsave' : 'Save'} ${place.name}`} aria-pressed={saved}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button></div><p className="place-address"><MapPin size={13} />{place.address}</p><div className="place-facts"><span className="distance"><Navigation size={12} />{place.distanceKm < .1 ? '< 0.1' : place.distanceKm.toFixed(1)} km away</span><span className={`hours ${place.openingHours === '24/7' ? 'always-open' : ''}`}>{place.openingHours === '24/7' ? <><span />Listed 24 hours</> : 'Hours unconfirmed'}</span></div>{place.category === 'hospital' && <p className="emergency-availability">{place.emergency === 'yes' ? 'Emergency service listed' : place.emergency === 'no' ? 'No emergency service listed' : 'Emergency department not confirmed'}</p>}<div className="place-actions"><a className="directions-button" href={directionsUrl(place)} target="_blank" rel="noreferrer"><Navigation size={14} />Directions<ArrowUpRight size={14} /></a>{phone ? <a className="place-call" href={phone} aria-label={`Call ${place.name}`}><Phone size={14} />Call</a> : <span className="no-phone">Phone not listed</span>}</div></article>;
}

function CouncilPanel() {
  const [zones, setZones] = useState<Zone[]>([]), [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState(''), [retryAt, setRetryAt] = useState(0), [countdown, setCountdown] = useState(0), [query, setQuery] = useState('');
  const load = useCallback(async () => {
    setStatus('loading');
    try { setZones(await findAllZones()); setStatus('ready'); }
    catch (err) { setStatus('error'); setError(err instanceof Error ? err.message : 'Council information is unavailable.'); if (err instanceof HttpError && err.status === 429) setRetryAt(Date.now() + Math.max(1, err.retryAfterSeconds || 60) * 1000); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const update = () => setCountdown(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [retryAt]);
  const filtered = zones.filter(z => `${z.nameEn || ''} ${z.nameMs} ${z.zoneCode} ${z.dunCode}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="secondary-panel council-panel"><div className="section-heading"><div><h2><Building2 size={23} /> Local council zones</h2><p>Administrative reference information from the Rebana License sandbox.</p></div><span className="connection-pill"><span className={`live-dot ${status !== 'ready' ? 'muted' : ''}`} />{status === 'ready' ? 'Connected to Rebana' : status === 'loading' ? 'Connecting…' : 'Connection unavailable'}</span></div><div className="council-explainer"><CircleHelp size={18} /><p>Council zones are administrative areas. Facility locations and emergency phone numbers are supplied separately; this council API does not provide an emergency directory.</p></div>{status === 'loading' ? <div className="empty-state" role="status"><RefreshCw className="spin" size={26} /><p>Loading council zones…</p></div> : status === 'error' ? <div className="empty-state" role="alert"><Building2 size={28} /><h3>Council information is unavailable</h3><p>{error}</p><button className="primary-button" onClick={load} disabled={countdown > 0}>{countdown > 0 ? `Retry in ${countdown}s` : 'Try again'}</button></div> : <><div className="council-search results-search"><Search size={18} /><input aria-label="Search council zones" placeholder="Search zone name, code or constituency…" value={query} onChange={e => setQuery(e.target.value)} /><span>{filtered.length} zones</span></div><div className="zone-grid">{filtered.map(zone => <article className="zone-card" key={zone.zoneCode}><div><span className="soft-icon"><MapPinned size={20} /></span><span className="zone-code">{zone.zoneCode}</span></div><h3>{zone.nameEn || zone.nameMs}</h3>{zone.nameEn && <p>{zone.nameMs}</p>}<small>Constituency · {zone.dunCode}</small></article>)}</div>{filtered.length === 0 && <p className="empty-state">No zones match your search.</p>}</>}</section>;
}
