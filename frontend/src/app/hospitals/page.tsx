'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  MapPin, Navigation, Building2, Phone, Mail, Wifi, WifiOff,
  Search, AlertCircle, RefreshCw, Locate, ChevronRight,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import { hospitalInformationApi } from '@/lib/api';
import type { HospitalInformation } from '@/lib/types';
import { geocodeAddress } from '@/lib/osm';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  return km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`;
}

interface MapViewProps {
  hospitals: HospitalInformation[];
  userLat: number | null;
  userLng: number | null;
  selected: number | null;
  onSelect: (id: number) => void;
}

function MapView({ hospitals, userLat, userLng, selected, onSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circlesRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    let aborted = false;
    import('leaflet').then((L) => {
      if (aborted || !mapRef.current || leafletMapRef.current) return;
      // Scrub any stale _leaflet_id left on the container from a previous mount
      // (happens on HMR, Strict Mode double-invoke, or navigation back to this page)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (mapRef.current as any)._leaflet_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const center: [number, number] = userLat !== null && userLng !== null ? [userLat, userLng] : [14.5995, 120.9842];
      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true });
      leafletMapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      map.setView(center, userLat !== null ? 12 : 6);
    });
    return () => {
      aborted = true;
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current || userLat === null || userLng === null) return;
    import('leaflet').then((L) => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      } else {
        const ui = L.divIcon({ html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,0.35)"></div>`, iconSize: [18,18], iconAnchor: [9,9], className:'' });
        userMarkerRef.current = L.marker([userLat, userLng], { icon: ui, zIndexOffset: 1000 }).addTo(leafletMapRef.current).bindPopup('<strong>Your Location</strong>');
      }
    });
  }, [userLat, userLng]);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    import('leaflet').then((L) => {
      markersRef.current.forEach(m => m.remove()); markersRef.current = [];
      circlesRef.current.forEach(c => c.remove()); circlesRef.current = [];

      const plotted: [number, number][] = [];

      hospitals.forEach(h => {
        // Normalise snake_case fields returned by the API
        const raw = h as unknown as Record<string, unknown>;
        const lat = h.latitude || (raw.latitude as number) || 0;
        const lng = h.longitude || (raw.longitude as number) || 0;
        if (!lat || !lng) return;

        const hid = Number(h.hospitalId ?? raw.hospital_id);
        const isSel = hid === selected;
        const name = String(h.hospitalName ?? raw.hospital_name ?? 'Hospital');
        const addr = String(h.address ?? '');
        // Prefer pre-computed distance from API (distance_km) over client-side distanceKm
        const distKm = h.distanceKm ?? (raw.distance_km as number | undefined);
        const dist = distKm !== undefined ? ` | ${fmtDist(distKm)}` : '';
        const svcRadius = h.serviceRadius || (raw.service_radius as number) || 0;

        const icon = L.divIcon({
          html: `<div style="width:${isSel?38:30}px;height:${isSel?38:30}px;border-radius:50%;background:${isSel?'#2563eb':'#1e40af'};border:3px solid #fff;box-shadow:0 2px 10px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
          iconSize: [isSel?38:30, isSel?38:30], iconAnchor: [isSel?19:15, isSel?19:15], className:''
        });
        const m = L.marker([lat, lng], { icon }).addTo(leafletMapRef.current)
          .bindPopup(`<div style="min-width:160px;font-family:system-ui,sans-serif"><strong style="font-size:14px">${name}</strong><br/><span style="color:#64748b;font-size:12px">${addr}${dist}</span>${svcRadius>0?`<br/><span style="font-size:11px;color:#2563eb">Radius: ${svcRadius} km</span>`:''}</div>`)
          .on('click', () => onSelect(hid));
        markersRef.current.push(m);
        plotted.push([lat, lng]);

        if (svcRadius > 0) {
          const c = L.circle([lat, lng], { radius: svcRadius * 1000, color: isSel?'#2563eb':'#3b82f6', fillColor: isSel?'#2563eb':'#3b82f6', fillOpacity: 0.05, weight: isSel?2:1, dashArray: isSel?'':'6 4' }).addTo(leafletMapRef.current);
          circlesRef.current.push(c);
        }
      });

      // Auto-fit bounds to show all plotted hospitals (+ user location if available)
      if (plotted.length > 0 && !selected) {
        const allPoints: [number, number][] = [...plotted];
        if (userLat !== null && userLng !== null) allPoints.push([userLat, userLng]);
        try {
          leafletMapRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 14, animate: true });
        } catch { /* bounds already set or map not ready */ }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitals, selected, userLat, userLng]);

  useEffect(() => {
    if (!leafletMapRef.current || selected === null) return;
    const h = hospitals.find(x => Number(x.hospitalId ?? (x as unknown as Record<string,unknown>).hospital_id) === selected);
    if (h && h.latitude && h.longitude) leafletMapRef.current.flyTo([h.latitude, h.longitude], 15, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return <div ref={mapRef} style={{ width:'100%', height:'100%', borderRadius:'var(--radius-lg)', overflow:'hidden', zIndex:0 }} />;
}

export default function HospitalsNearYouPage() {
  const [hospitals, setHospitals] = useState<HospitalInformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [addressInput, setAddressInput] = useState('');
  const [searchingAddr, setSearchingAddr] = useState(false);
  const [matchedAddr, setMatchedAddr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadHospitals = useCallback(async (lat: number | null, lng: number | null, radius: number) => {
    setLoading(true);
    try {
      // Always fetch all hospitals so newly-added ones (with or without coordinates) appear
      const allRes = await hospitalInformationApi.getAll();
      const allData = allRes?.data;
      let allList: HospitalInformation[] = Array.isArray(allData) ? allData : Array.isArray(allData?.items) ? allData.items : [];

      if (lat !== null && lng !== null) {
        // Compute client-side distances for all hospitals that have coordinates
        allList = allList.map(h => {
          const raw = h as unknown as Record<string, unknown>;
          const hLat = h.latitude || (raw.latitude as number) || 0;
          const hLng = h.longitude || (raw.longitude as number) || 0;
          if (hLat && hLng) {
            return { ...h, distanceKm: haversine(lat, lng, hLat, hLng) };
          }
          return h; // no coords — keep but no distance
        });

        // Sort: hospitals with coords and within radius first, then others
        allList.sort((a, b) => {
          const aDist = a.distanceKm ?? 99999;
          const bDist = b.distanceKm ?? 99999;
          return aDist - bDist;
        });
      }

      setHospitals(allList);
    } catch { console.error('Failed to load hospitals'); }
    finally { setLoading(false); }
  }, []);

  const requestLocation = useCallback((radius: number) => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); loadHospitals(null, null, radius); return; }
    setLocating(true); setGeoError(null); setMatchedAddr(null);
    navigator.geolocation.getCurrentPosition(
      pos => { const lat = pos.coords.latitude; const lng = pos.coords.longitude; setUserLat(lat); setUserLng(lng); setLocating(false); loadHospitals(lat, lng, radius); },
      err => { setGeoError(`Could not get location: ${err.message}`); setLocating(false); loadHospitals(null, null, radius); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [loadHospitals]);

  const handleSearchByAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = addressInput.trim();
    if (!q) return;
    setSearchingAddr(true);
    setGeoError(null);
    try {
      const geo = await geocodeAddress(q);
      if (geo.found && geo.latitude !== undefined && geo.longitude !== undefined) {
        setUserLat(geo.latitude);
        setUserLng(geo.longitude);
        setMatchedAddr(geo.displayName || q);
        loadHospitals(geo.latitude, geo.longitude, radiusKm);
      } else {
        setGeoError(geo.message || 'Address not found on OpenStreetMap.');
      }
    } catch {
      setGeoError('Failed to geocode address.');
    } finally {
      setSearchingAddr(false);
    }
  };

  useEffect(() => { requestLocation(25); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = hospitals.filter(h => {
    const raw = h as unknown as Record<string,unknown>;
    const name = String(h.hospitalName ?? raw.hospital_name ?? '').toLowerCase();
    const addr = String(h.address ?? '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || addr.includes(search.toLowerCase());
    if (!matchesSearch) return false;

    // Radius filter: only apply when we have a user location AND showAll is false
    if (userLat !== null && userLng !== null && !showAll) {
      const dist = h.distanceKm;
      // If hospital has no coordinates, still show it (it just won't appear on map)
      const hLat = h.latitude || (raw.latitude as number) || 0;
      const hLng = h.longitude || (raw.longitude as number) || 0;
      if (hLat && hLng && dist !== undefined && dist > radiusKm) return false;
    }

    return true;
  });

  return (
    <AppLayout>
      <div style={{ display:'flex', flexDirection:'column', gap:16, height:'calc(100vh - 80px)' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
              <MapPin size={22} style={{ color:'var(--primary)' }} /> Hospitals Near You
            </h1>
            <p className="page-subtitle">
              {matchedAddr
                ? `Showing hospitals near ${matchedAddr}`
                : userLat !== null
                ? `${hospitals.length} hospital${hospitals.length!==1?'s':''} within ${radiusKm} km`
                : 'Enter your address or enable location to discover nearby hospitals'}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:13, color:'var(--muted)', fontWeight:500 }}>Radius:</label>
            <select value={radiusKm} onChange={e => { const r=Number(e.target.value); setRadiusKm(r); setShowAll(false); loadHospitals(userLat, userLng, r); }}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--card-border)', background:'var(--card-bg)', color:'var(--foreground)', fontSize:13, cursor:'pointer' }}>
              {[5,10,15,25,50,100].map(r => <option key={r} value={r}>{r} km</option>)}
            </select>
            <button
              onClick={() => setShowAll(v => !v)}
              style={{ padding:'7px 13px', borderRadius:8, border:'1px solid var(--card-border)', background: showAll ? 'var(--primary)' : 'var(--card-bg)', color: showAll ? '#fff' : 'var(--foreground)', fontSize:13, fontWeight:600, cursor:'pointer' }}
            >
              {showAll ? '✓ All Hospitals' : 'Show All'}
            </button>
            <button onClick={() => requestLocation(radiusKm)} disabled={locating}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, background:'var(--primary)', color:'#fff', border:'none', cursor:locating?'not-allowed':'pointer', fontSize:13, fontWeight:600, opacity:locating?0.7:1 }}>
              {locating ? <RefreshCw size={14} style={{ animation:'spin 1s linear infinite' }} /> : <Locate size={14} />}
              {locating ? 'Locating…' : 'Use Current GPS'}
            </button>
          </div>
        </div>

        {/* Address Search Bar */}
        <form onSubmit={handleSearchByAddress} style={{ display: 'flex', gap: 8, maxWidth: 640 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 'none' }}>
            <MapPin size={15} style={{ color: 'var(--muted)' }} />
            <input
              placeholder="Or enter your home / patient address (e.g. Manila, Quezon City, Taft Ave)…"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={searchingAddr || !addressInput.trim()}
            style={{
              padding: '0 16px',
              borderRadius: 8,
              background: 'var(--accent)',
              border: '1px solid var(--card-border)',
              color: 'var(--foreground)',
              fontSize: 13,
              fontWeight: 600,
              cursor: searchingAddr || !addressInput.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {searchingAddr ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Navigation size={13} />}
            Find Near Address
          </button>
        </form>

        {geoError && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', color:'#dc2626', fontSize:13 }}>
            <WifiOff size={16} /><span>{geoError} — showing all registered hospitals.</span>
          </div>
        )}
        {userLat !== null && !geoError && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.25)', color:'#059669', fontSize:13 }}>
            <Wifi size={16} />
            <span>
              {matchedAddr ? `📍 Address located: ${matchedAddr}` : `GPS acquired: ${userLat.toFixed(5)}, ${userLng!.toFixed(5)}`}
            </span>
          </div>
        )}

        <div style={{ display:'flex', gap:16, flex:1, minHeight:0 }}>
          <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>
            <div className="search-bar">
              <Search size={15} style={{ color:'var(--muted)' }} />
              <input placeholder="Search hospitals…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, paddingRight:2 }}>
              {loading ? <Spinner center /> : filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>
                  <AlertCircle size={32} style={{ marginBottom:8, opacity:0.4 }} />
                  <p style={{ fontWeight:600, fontSize:14 }}>No hospitals found</p>
                  <p style={{ fontSize:12, marginTop:4 }}>
                    {userLat !== null
                      ? <>Try a larger radius or click <strong>Show All</strong> to see all registered hospitals.</>
                      : 'Enable location access or use the address search.'}
                  </p>
                </div>
              ) : filtered.map(h => {
                const raw = h as unknown as Record<string,unknown>;
                const hid = Number(h.hospitalId ?? raw.hospital_id);
                const name = String(h.hospitalName ?? raw.hospital_name ?? 'Hospital');
                const addr = String(h.address ?? '—');
                const phone = String(h.phoneNumber ?? raw.phone_number ?? '');
                const email = String(h.email ?? '');
                const isSel = hid === selectedId;
                const hasCoords = !!(h.latitude || (raw.latitude as number) || 0);
                return (
                  <div key={hid} onClick={() => setSelectedId(hid)} style={{ padding:14, borderRadius:10, cursor:'pointer', border:isSel?'2px solid var(--primary)':'1px solid var(--card-border)', background:isSel?'rgba(37,99,235,0.06)':'var(--card-bg)', transition:'all 0.15s ease', position:'relative' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                        <div style={{ width:36, height:36, borderRadius:8, flexShrink:0, background:isSel?'rgba(37,99,235,0.15)':'rgba(37,99,235,0.08)', color:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <Building2 size={18} />
                        </div>
                        <div style={{ minWidth:0 }}>
                          <p style={{ fontWeight:700, fontSize:13.5, color:'var(--foreground)', marginBottom:2 }}>{name}</p>
                          <p style={{ fontSize:12, color:'var(--muted)', lineHeight:1.4 }}>{addr}</p>
                        </div>
                      </div>
                      {h.distanceKm !== undefined && <span style={{ fontSize:11, fontWeight:700, color:'var(--primary)', background:'rgba(37,99,235,0.1)', padding:'2px 7px', borderRadius:99, flexShrink:0, marginLeft:6, whiteSpace:'nowrap' }}>{fmtDist(h.distanceKm)}</span>}
                    </div>
                    {(phone || email) && (
                      <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3 }}>
                        {phone && <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--muted)' }}><Phone size={11} style={{ color:'var(--primary)' }} /><span>{phone}</span></div>}
                        {email && <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, color:'var(--muted)' }}><Mail size={11} style={{ color:'var(--primary)' }} /><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:200 }}>{email}</span></div>}
                      </div>
                    )}
                    {h.serviceRadius && h.serviceRadius > 0 && <div style={{ marginTop:8 }}><Badge variant="info">{h.serviceRadius} km service area</Badge></div>}
                    {!hasCoords && <div style={{ marginTop:6 }}><Badge variant="warning">⚠ No map coordinates — edit to add address</Badge></div>}
                    {isSel && <ChevronRight size={16} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--primary)' }} />}

                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex:1, borderRadius:'var(--radius-lg)', border:'1px solid var(--card-border)', overflow:'hidden', position:'relative', minHeight:400 }}>
            {/* eslint-disable-next-line @next/next/no-css-tags */}
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossOrigin="" />
            {loading && <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, backdropFilter:'blur(3px)', background:'rgba(0,0,0,0.04)' }}><Spinner center /></div>}
            <MapView hospitals={filtered} userLat={userLat} userLng={userLng} selected={selectedId} onSelect={setSelectedId} />
            <div style={{ position:'absolute', top:12, left:12, zIndex:900, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8, padding:'6px 10px', fontSize:11.5, color:'var(--muted)', display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
              <Navigation size={12} style={{ color:'var(--primary)' }} /> Powered by OpenStreetMap
            </div>
            <div style={{ position:'absolute', bottom:24, right:16, zIndex:900, background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:10, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
              <div style={{ fontWeight:700, marginBottom:6, color:'var(--foreground)' }}>Legend</div>
              <div style={{ display:'flex', alignItems:'center', gap:7, color:'var(--muted)', marginBottom:4 }}><span style={{ width:12, height:12, borderRadius:'50%', background:'#2563eb', display:'inline-block', border:'2px solid #fff', boxShadow:'0 0 0 2px rgba(37,99,235,0.35)', flexShrink:0 }} />Your Location</div>
              <div style={{ display:'flex', alignItems:'center', gap:7, color:'var(--muted)', marginBottom:4 }}><span style={{ width:12, height:12, borderRadius:'50%', background:'#1e40af', display:'inline-block', flexShrink:0 }} />Hospital</div>
              <div style={{ display:'flex', alignItems:'center', gap:7, color:'var(--muted)' }}><span style={{ width:14, height:14, borderRadius:'50%', display:'inline-block', flexShrink:0, border:'2px dashed #3b82f6', background:'rgba(59,130,246,0.08)' }} />Service area</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}
