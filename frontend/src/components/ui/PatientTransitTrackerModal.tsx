'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Navigation, Car, Clock, Phone, AlertCircle,
  Building2, User, RefreshCw, CheckCircle2, ChevronRight,
  Crosshair, Layers, Maximize2, ShieldAlert, Radio, Play, Pause,
  Home, Compass
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { geocodeAddress } from '@/lib/osm';
import { hospitalInformationApi, patientApi, resolveApiImageUrl } from '@/lib/api';
import type { HospitalInformation, Appointment, Patient } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

interface PatientTransitTrackerModalProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  patient: Patient | null;
  hospital?: HospitalInformation | null;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PatientTransitTrackerModal({
  open,
  onClose,
  appointment,
  patient,
  hospital: initialHospital,
}: PatientTransitTrackerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const routeShadowRef = useRef<any>(null);
  const transitMarkerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const hospMarkerRef = useRef<any>(null);
  const gpsAccuracyCircleRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchGpsIdRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);

  const aptId = Number(appointment?.appointmentId ?? (appointment as any)?.appointment_id ?? 0);
  const storageKey = `patient_transit_progress_${aptId}`;

  const [loading, setLoading] = useState(true);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(patient);
  const [patientCoords, setPatientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitalCoords, setHospitalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<HospitalInformation | null>(initialHospital ?? null);

  // Default is strictly 0 (NOT YET ON THE WAY / AT HOME) unless previously saved for this appointment
  const [transitProgress, setTransitProgress] = useState<number>(() => {
    if (typeof window !== 'undefined' && aptId > 0) {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val)) return Math.min(Math.max(val, 0), 1);
      }
    }
    return 0; // Default: Not yet on the way
  });

  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number>(0);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(0);
  const [expandedInfo, setExpandedInfo] = useState<boolean>(true);

  // Live GPS Tracking state
  const [isUsingLiveGps, setIsUsingLiveGps] = useState<boolean>(false);
  const [liveGpsCoords, setLiveGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveGpsAccuracy, setLiveGpsAccuracy] = useState<number | null>(null);

  // Simulation play state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Sync passed patient
  useEffect(() => {
    setCurrentPatient(patient);
  }, [patient]);

  // Save progress change to localStorage
  const updateTransitProgress = useCallback((newVal: number) => {
    const clamped = Math.min(Math.max(newVal, 0), 1);
    setTransitProgress(clamped);
    if (typeof window !== 'undefined' && aptId > 0) {
      localStorage.setItem(storageKey, String(clamped));
    }
  }, [aptId, storageKey]);

  // If patient details (or profilePicturePath) is missing, fetch full profile from API
  useEffect(() => {
    if (!open) return;
    let mounted = true;

    const pId = Number(
      patient?.patientId ??
      (patient as any)?.patient_id ??
      appointment?.patientId ??
      (appointment as any)?.patient_id ??
      0
    );

    if (pId > 0 && (!patient || !patient.profilePicturePath)) {
      patientApi.getById(pId).then((res) => {
        if (mounted && res.data) {
          setCurrentPatient(res.data);
        }
      }).catch(() => {
        // keep fallback
      });
    }

    return () => {
      mounted = false;
    };
  }, [open, patient, appointment]);

  // 1. Resolve Locations (Hospital & Patient Address)
  useEffect(() => {
    if (!open || !appointment) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const initTracker = async () => {
      try {
        // Resolve Hospital Location
        let hosp = hospitalInfo;
        if (!hosp) {
          try {
            const hRes = await hospitalInformationApi.getAll();
            const hList = Array.isArray(hRes.data)
              ? hRes.data
              : Array.isArray((hRes.data as any)?.items)
              ? (hRes.data as any).items
              : [];
            if (hList.length > 0) {
              hosp = hList[0];
              if (mounted) setHospitalInfo(hosp);
            }
          } catch {
            // fallback
          }
        }

        // Default to hospital coords
        const hLat = Number((hosp as any)?.latitude ?? (hosp as any)?.lat ?? 14.5995);
        const hLng = Number((hosp as any)?.longitude ?? (hosp as any)?.lng ?? 120.9842);
        if (mounted) setHospitalCoords({ lat: hLat, lng: hLng });

        // Resolve Patient Address
        const effectivePatient = currentPatient || patient;
        const rawP = effectivePatient as unknown as Record<string, unknown> | null;
        const pAddress = String(effectivePatient?.address ?? rawP?.address ?? '').trim();

        let pLat = 14.5800;
        let pLng = 121.0000;

        if (pAddress) {
          const geoRes = await geocodeAddress(pAddress);
          if (geoRes.found && typeof geoRes.latitude === 'number' && typeof geoRes.longitude === 'number') {
            pLat = geoRes.latitude;
            pLng = geoRes.longitude;
          } else {
            pLat = hLat - 0.042;
            pLng = hLng - 0.038;
          }
        } else {
          pLat = hLat - 0.045;
          pLng = hLng + 0.032;
        }

        if (mounted) {
          setPatientCoords({ lat: pLat, lng: pLng });
        }
      } catch (err) {
        console.error('Failed to init GPS transit coordinates:', err);
        if (mounted) setError('Could not calculate real-time GPS transit coordinates.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initTracker();

    return () => {
      mounted = false;
    };
  }, [open, appointment, currentPatient, patient]);

  // 2. Fetch Actual Driving Road Geometry using OpenStreetMap OSRM Routing
  useEffect(() => {
    const origin = liveGpsCoords || patientCoords;
    if (!origin || !hospitalCoords) return;

    let mounted = true;

    const fetchRoadRouting = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${hospitalCoords.lng},${hospitalCoords.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const points: [number, number][] = route.geometry.coordinates.map(
              (c: [number, number]) => [c[1], c[0]]
            );
            setRoadCoordinates(points);

            const distKm = route.distance / 1000;
            const safeDist = Math.max(distKm, 0.5);
            setRouteDistanceKm(safeDist);

            const durMins = Math.round(route.duration / 60) + 4;
            setEstimatedMinutes(Math.max(durMins, 3));
            return;
          }
        }
      } catch (err) {
        console.warn('OSRM road routing fallback:', err);
      }

      // Fallback
      if (mounted) {
        const dist = haversineDistanceKm(origin.lat, origin.lng, hospitalCoords.lat, hospitalCoords.lng);
        const safeDist = Math.max(dist, 1.2);
        setRouteDistanceKm(safeDist);
        setEstimatedMinutes(Math.round((safeDist / 22) * 60) + 5);
        setRoadCoordinates([
          [origin.lat, origin.lng],
          [hospitalCoords.lat, hospitalCoords.lng],
        ]);
      }
    };

    fetchRoadRouting();

    return () => {
      mounted = false;
    };
  }, [liveGpsCoords, patientCoords, hospitalCoords]);

  // Helper to interpolate point along road coordinates
  const getPointAtProgress = useCallback((prog: number): [number, number] => {
    const origin = liveGpsCoords || patientCoords;
    if (!origin || !hospitalCoords) return [14.5995, 120.9842];

    if (roadCoordinates.length > 1) {
      const idx = Math.min(
        Math.floor(prog * (roadCoordinates.length - 1)),
        roadCoordinates.length - 1
      );
      return roadCoordinates[idx];
    }

    return [
      origin.lat + (hospitalCoords.lat - origin.lat) * prog,
      origin.lng + (hospitalCoords.lng - origin.lng) * prog,
    ];
  }, [liveGpsCoords, patientCoords, hospitalCoords, roadCoordinates]);

  // Compute patient info & photo URLs
  const effectivePatient = currentPatient || patient;
  const rawP = effectivePatient as unknown as Record<string, unknown> | null;
  const pName = [
    effectivePatient?.firstName ?? rawP?.first_name,
    rawP?.middle_name,
    effectivePatient?.lastName ?? rawP?.last_name,
  ].filter(Boolean).join(' ') || 'Patient';
  const firstNameOnly = effectivePatient?.firstName || (rawP?.first_name as string) || pName.split(' ')[0] || 'Patient';
  const pAddress = String(effectivePatient?.address ?? rawP?.address ?? 'Philippine Address not recorded');
  const pPhone = String(effectivePatient?.phone ?? rawP?.phone ?? '');

  const rawPic = String(effectivePatient?.profilePicturePath || rawP?.profile_picture_path || '');
  const resolvedPicUrl = resolveApiImageUrl(rawPic);
  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(pName)}&background=2563eb&color=ffffff&size=128&bold=true`;
  const patientPhotoUrl = resolvedPicUrl || fallbackAvatarUrl;

  const activeOrigin = liveGpsCoords || patientCoords;
  const isOnTheWay = transitProgress > 0 && transitProgress < 1;
  const isArrived = transitProgress >= 1;
  const isAtOrigin = transitProgress === 0;

  const remainingMins = Math.max(Math.round(estimatedMinutes * (1 - transitProgress)), 1);
  const remainingDist = (routeDistanceKm * (1 - transitProgress)).toFixed(1);

  // 3. Live Device GPS Tracking via navigator.geolocation
  const handleToggleLiveGps = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    if (isUsingLiveGps) {
      if (watchGpsIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchGpsIdRef.current);
        watchGpsIdRef.current = null;
      }
      setIsUsingLiveGps(false);
      setLiveGpsCoords(null);
      setLiveGpsAccuracy(null);
      if (gpsAccuracyCircleRef.current) {
        gpsAccuracyCircleRef.current.remove();
        gpsAccuracyCircleRef.current = null;
      }
    } else {
      setIsUsingLiveGps(true);
      watchGpsIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setLiveGpsCoords({ lat, lng });
          setLiveGpsAccuracy(acc);

          if (leafletMapRef.current) {
            import('leaflet').then((L) => {
              if (gpsAccuracyCircleRef.current) {
                gpsAccuracyCircleRef.current.setLatLng([lat, lng]);
                gpsAccuracyCircleRef.current.setRadius(acc);
              } else if (leafletMapRef.current) {
                gpsAccuracyCircleRef.current = L.circle([lat, lng], {
                  radius: acc,
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.15,
                  weight: 1.5,
                }).addTo(leafletMapRef.current);
              }
            });
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          alert('Could not acquire live device GPS. Check location permissions.');
          setIsUsingLiveGps(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    }
  }, [isUsingLiveGps]);

  // Clean up GPS watch and timers on unmount
  useEffect(() => {
    return () => {
      if (watchGpsIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchGpsIdRef.current);
        watchGpsIdRef.current = null;
      }
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      timeoutIdsRef.current.forEach((t) => clearTimeout(t));
      timeoutIdsRef.current = [];
    };
  }, []);

  // 4. Automatic Transit Simulation Runner
  useEffect(() => {
    if (isSimulating) {
      simulationTimerRef.current = setInterval(() => {
        setTransitProgress((prev) => {
          if (prev >= 1) {
            setIsSimulating(false);
            if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
            return 1;
          }
          const next = Math.min(prev + 0.05, 1);
          if (typeof window !== 'undefined' && aptId > 0) {
            localStorage.setItem(storageKey, String(next));
          }
          return next;
        });
      }, 1500);
    } else {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    }

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
    };
  }, [isSimulating, aptId, storageKey]);

  // 5. Leaflet Map Initialization — Created ONCE when coordinates are resolved
  useEffect(() => {
    if (!open || loading || !patientCoords || !hospitalCoords || !mapContainerRef.current) return;

    let aborted = false;

    // Clear any previous pending timeouts
    timeoutIdsRef.current.forEach((t) => clearTimeout(t));
    timeoutIdsRef.current = [];

    import('leaflet').then((L) => {
      if (aborted || !mapContainerRef.current) return;

      // Clean up previous map cleanly
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.stop();
          leafletMapRef.current.remove();
        } catch {
          // Ignore
        }
        leafletMapRef.current = null;
      }
      delete (mapContainerRef.current as any)._leaflet_id;

      // Create new Leaflet Map instance
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      });
      leafletMapRef.current = map;

      // OpenStreetMap high-res tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Clinic Destination Marker
      const hospIcon = L.divIcon({
        html: `
          <div style="background:#dc2626;color:#ffffff;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(220,38,38,0.5);border:3px solid #ffffff;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12m-6-6h12"/></svg>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        className: 'custom-hosp-pin',
      });

      const hospMarker = L.marker([hospitalCoords.lat, hospitalCoords.lng], { icon: hospIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;padding:4px 6px;">
            <strong style="color:#dc2626;font-size:13px;">🏥 ${hospitalInfo?.hospitalName || 'Destination Clinic'}</strong>
            <p style="margin:4px 0 0;font-size:11px;color:#4b5563;">${hospitalInfo?.address || 'Medical Facility'}</p>
          </div>
        `);
      hospMarkerRef.current = hospMarker;

      // Patient Origin Marker
      const originIcon = L.divIcon({
        html: `
          <div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:0px;border-radius:50%;background:rgba(37,99,235,0.25);animation:ping 2.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:42px;height:42px;border-radius:50%;overflow:hidden;border:3px solid #2563eb;box-shadow:0 4px 14px rgba(37,99,235,0.5);background:#ffffff;">
              <img src="${patientPhotoUrl}" alt="${pName}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}';" />
            </div>
            <div style="position:absolute;bottom:0px;right:0px;width:20px;height:20px;border-radius:50%;background:#2563eb;color:#ffffff;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:10;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div style="position:absolute;top:-24px;left:50%;transform:translateX(-50%);background:rgba(30,58,138,0.94);backdrop-filter:blur(4px);color:#ffffff;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;border:1px solid rgba(255,255,255,0.18);">
              ${firstNameOnly} (At Home)
            </div>
          </div>
        `,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
        className: 'custom-origin-pin',
      });

      const originMarker = L.marker([patientCoords.lat, patientCoords.lng], { icon: originIcon, zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;padding:6px;display:flex;align-items:center;gap:12px;min-width:220px;">
            <div style="width:46px;height:46px;border-radius:50%;overflow:hidden;border:2.5px solid #2563eb;flex-shrink:0;box-shadow:0 2px 8px rgba(37,99,235,0.3);">
              <img src="${patientPhotoUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}';" />
            </div>
            <div>
              <strong style="color:#0f172a;font-size:13px;display:block;">${pName}</strong>
              <span style="display:inline-block;margin-top:2px;font-size:11px;font-weight:700;color:#f59e0b;">
                🏠 Patient at Home (Not Yet On The Way)
              </span>
              <p style="margin:2px 0 0;font-size:11px;color:#64748b;line-height:1.3;max-width:200px;">${pAddress}</p>
            </div>
          </div>
        `);
      originMarkerRef.current = originMarker;

      // Initial route lines
      const initialRoad: any = [
        [patientCoords.lat, patientCoords.lng],
        [hospitalCoords.lat, hospitalCoords.lng],
      ];

      const polyShadow = L.polyline(initialRoad, {
        color: '#1e3a8a',
        weight: 7,
        opacity: 0.22,
      }).addTo(map);
      routeShadowRef.current = polyShadow;

      const polyline = L.polyline(initialRoad, {
        color: '#2563eb',
        weight: 4.5,
        opacity: 0.85,
        dashArray: '6, 6',
      }).addTo(map);
      routeLineRef.current = polyline;

      // Fit bounds
      const bounds = L.latLngBounds([
        [patientCoords.lat, patientCoords.lng],
        [hospitalCoords.lat, hospitalCoords.lng],
      ]);
      map.fitBounds(bounds, { padding: [70, 70] });

      const safeInvalidate = () => {
        if (leafletMapRef.current && (leafletMapRef.current as any)._container) {
          try {
            leafletMapRef.current.invalidateSize();
          } catch {
            // Ignore
          }
        }
      };

      const t1 = setTimeout(safeInvalidate, 100);
      const t2 = setTimeout(safeInvalidate, 300);
      const t3 = setTimeout(safeInvalidate, 700);
      timeoutIdsRef.current.push(t1, t2, t3);

      if (mapContainerRef.current && window.ResizeObserver) {
        resizeObserverRef.current = new ResizeObserver(() => {
          safeInvalidate();
        });
        resizeObserverRef.current.observe(mapContainerRef.current);
      }
    });

    return () => {
      aborted = true;
      timeoutIdsRef.current.forEach((t) => clearTimeout(t));
      timeoutIdsRef.current = [];
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.stop();
          leafletMapRef.current.remove();
        } catch {
          // Ignore
        }
        leafletMapRef.current = null;
      }
    };
  }, [open, loading, patientCoords?.lat, patientCoords?.lng, hospitalCoords?.lat, hospitalCoords?.lng]);

  // 6. Update Route Lines smoothly when roadCoordinates change (WITHOUT destroying the map)
  useEffect(() => {
    if (!leafletMapRef.current || !routeLineRef.current || roadCoordinates.length < 2) return;
    try {
      const road: any = roadCoordinates;
      routeLineRef.current.setLatLngs(road);
      if (routeShadowRef.current) {
        routeShadowRef.current.setLatLngs(road);
      }
    } catch {
      // Ignore
    }
  }, [roadCoordinates]);

  // 7. Update Origin Marker when live GPS is toggled
  useEffect(() => {
    if (!leafletMapRef.current || !originMarkerRef.current) return;
    const origin = liveGpsCoords || patientCoords;
    if (!origin) return;

    try {
      originMarkerRef.current.setLatLng([origin.lat, origin.lng]);
    } catch {
      // Ignore
    }
  }, [liveGpsCoords, patientCoords]);

  // 8. Transit Marker Management (Created when on the way, removed when at home)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      if (!leafletMapRef.current) return;

      // If at home (0%), remove the transit car marker so only the home pin shows
      if (transitProgress === 0) {
        if (transitMarkerRef.current) {
          try {
            transitMarkerRef.current.remove();
          } catch {
            // Ignore
          }
          transitMarkerRef.current = null;
        }
        return;
      }

      // If on the way (progress > 0), position car marker along the road
      const curPos = getPointAtProgress(transitProgress);

      if (!transitMarkerRef.current) {
        const transitIcon = L.divIcon({
          html: `
            <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(5,150,105,0.35);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="position:relative;width:44px;height:44px;border-radius:50%;overflow:hidden;border:3px solid #059669;box-shadow:0 4px 16px rgba(5,150,105,0.65);background:#ffffff;">
                <img src="${patientPhotoUrl}" alt="${pName}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}';" />
              </div>
              <div style="position:absolute;bottom:0px;right:0px;width:22px;height:22px;border-radius:50%;background:#059669;color:#ffffff;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.35);z-index:10;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
              <div style="position:absolute;top:-26px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);backdrop-filter:blur(4px);color:#ffffff;padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none;border:1px solid rgba(255,255,255,0.18);">
                ${firstNameOnly} (On The Way)
              </div>
            </div>
          `,
          iconSize: [56, 56],
          iconAnchor: [28, 28],
          className: 'custom-transit-pin',
        });

        const transitMarker = L.marker([curPos[0], curPos[1]], {
          icon: transitIcon,
          zIndexOffset: 3000,
        }).addTo(map);

        transitMarker.bindPopup(`
          <div style="font-family:sans-serif;padding:6px;display:flex;align-items:center;gap:12px;min-width:210px;">
            <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2.5px solid #059669;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,0.3);">
              <img src="${patientPhotoUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}';" />
            </div>
            <div>
              <strong style="color:#0f172a;font-size:13px;display:block;">${pName}</strong>
              <span style="display:inline-block;margin-top:2px;font-size:11px;font-weight:700;color:#059669;">
                ● On The Way (${Math.round(transitProgress * 100)}%)
              </span>
              <p style="margin:2px 0 0;font-size:11.5px;color:#64748b;">
                ${transitProgress >= 1 ? 'Patient arrived at clinic!' : `Approx. ${Math.max(Math.round(estimatedMinutes * (1 - transitProgress)), 1)} mins remaining`}
              </p>
            </div>
          </div>
        `);

        transitMarkerRef.current = transitMarker;
      } else {
        try {
          transitMarkerRef.current.setLatLng([curPos[0], curPos[1]]);
          transitMarkerRef.current.setPopupContent(`
            <div style="font-family:sans-serif;padding:6px;display:flex;align-items:center;gap:12px;min-width:210px;">
              <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2.5px solid #059669;flex-shrink:0;box-shadow:0 2px 8px rgba(5,150,105,0.3);">
                <img src="${patientPhotoUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.onerror=null;this.src='${fallbackAvatarUrl}';" />
              </div>
              <div>
                <strong style="color:#0f172a;font-size:13px;display:block;">${pName}</strong>
                <span style="display:inline-block;margin-top:2px;font-size:11px;font-weight:700;color:#059669;">
                  ● On The Way (${Math.round(transitProgress * 100)}%)
                </span>
                <p style="margin:2px 0 0;font-size:11.5px;color:#64748b;">
                  ${transitProgress >= 1 ? 'Patient arrived at clinic!' : `Approx. ${Math.max(Math.round(estimatedMinutes * (1 - transitProgress)), 1)} mins remaining`}
                </p>
              </div>
            </div>
          `);
        } catch {
          // Ignore
        }
      }
    });
  }, [transitProgress, getPointAtProgress, estimatedMinutes, patientPhotoUrl, pName, firstNameOnly, fallbackAvatarUrl]);

  // Map control helpers
  const handleRecenterRoute = useCallback(() => {
    if (!leafletMapRef.current || !activeOrigin || !hospitalCoords) return;
    import('leaflet').then((L) => {
      try {
        const bounds = L.latLngBounds([
          [activeOrigin.lat, activeOrigin.lng],
          [hospitalCoords.lat, hospitalCoords.lng],
        ]);
        leafletMapRef.current.fitBounds(bounds, { padding: [70, 70] });
      } catch {
        // Ignore
      }
    });
  }, [activeOrigin, hospitalCoords]);

  const handleFocusVehicle = useCallback(() => {
    if (!leafletMapRef.current) return;
    try {
      if (transitProgress === 0 && activeOrigin) {
        leafletMapRef.current.setView([activeOrigin.lat, activeOrigin.lng], 16, { animate: true });
        if (originMarkerRef.current) originMarkerRef.current.openPopup();
        return;
      }
      const curPos = getPointAtProgress(transitProgress);
      leafletMapRef.current.setView([curPos[0], curPos[1]], 16, { animate: true });
      if (transitMarkerRef.current) {
        transitMarkerRef.current.openPopup();
      }
    } catch {
      // Ignore
    }
  }, [transitProgress, activeOrigin, getPointAtProgress]);

  if (!open || !appointment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Live Patient Transit Tracker"
      subtitle={`Real-time GPS transit & location monitoring for ${pName}`}
      maxWidth={1080}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: isAtOrigin ? '#f59e0b' : (isArrived ? '#059669' : '#10b981'),
                display: 'inline-block',
                boxShadow: `0 0 8px ${isAtOrigin ? '#f59e0b' : '#10b981'}`,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
              {isUsingLiveGps
                ? 'Live Satellite GPS Active · Device coordinates streaming'
                : 'Live Telematics Active · Route computed with OpenStreetMap Philippine Driving Roads'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" size="sm" icon={Crosshair} onClick={handleRecenterRoute}>
              Fit Whole Route
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done Tracking
            </Button>
          </div>
        </div>
      }
    >
      {/* ── WHOLE MAP IMMERSIVE VIEWPORT ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 600,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1.5px solid var(--card-border)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
          background: 'var(--card-bg)',
        }}
      >
        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--card-bg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 1000,
            }}
          >
            <Spinner center />
            <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
              Connecting to GPS telematics & rendering road map...
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--danger-bg, rgba(239, 68, 68, 0.12))',
              border: '1px solid var(--danger-border, rgba(239, 68, 68, 0.3))',
              color: 'var(--danger-text, #ef4444)',
              fontSize: 13,
              fontWeight: 500,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* ── BASE LEAFLET WHOLE MAP CANVAS ── */}
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
          }}
        />

        {/* ── FLOATING TOP HUD (Status, ETA, Distance & Controls) ── */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            zIndex: 500,
            pointerEvents: 'none',
            flexWrap: 'wrap',
          }}
        >
          {/* Live Telematics Badge & ETA */}
          <div
            style={{
              pointerEvents: 'auto',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: '8px 16px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Status indicator: Distinguishes "Not Yet On The Way" vs "On The Way" vs "Arrived" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isAtOrigin ? '#f59e0b' : (isArrived ? '#059669' : '#10b981'),
                  boxShadow: `0 0 10px ${isAtOrigin ? '#f59e0b' : '#10b981'}`,
                  animation: isOnTheWay ? 'pulse 1.5s infinite' : 'none',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: isAtOrigin ? '#d97706' : (isArrived ? '#059669' : '#0f172a') }}>
                {isAtOrigin
                  ? 'Not Yet On The Way (At Origin)'
                  : isArrived
                  ? 'Patient Arrived at Clinic'
                  : `On The Way (${Math.round(transitProgress * 100)}%)`}
              </span>
            </div>

            <div style={{ width: 1, height: 20, background: '#cbd5e1' }} />

            {/* ETA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: '#2563eb' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                ETA:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {isArrived ? 'Arrived' : isAtOrigin ? `~${estimatedMinutes} mins travel time` : `~${remainingMins} mins`}
                </strong>
              </span>
            </div>

            <div style={{ width: 1, height: 20, background: '#cbd5e1' }} />

            {/* Distance remaining */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={15} style={{ color: '#7c3aed' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Distance:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {isArrived ? '0 km' : isAtOrigin ? `${routeDistanceKm.toFixed(1)} km to clinic` : `${remainingDist} km`}
                </strong>
              </span>
            </div>
          </div>

          {/* Quick Map Action Buttons */}
          <div
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Live GPS Button */}
            <button
              type="button"
              onClick={handleToggleLiveGps}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                background: isUsingLiveGps ? 'rgba(37, 99, 235, 0.95)' : 'rgba(255, 255, 255, 0.94)',
                color: isUsingLiveGps ? '#ffffff' : '#0f172a',
                backdropFilter: 'blur(8px)',
                border: isUsingLiveGps ? '1px solid #2563eb' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Track live physical device GPS coordinates"
            >
              <Radio size={15} style={{ color: isUsingLiveGps ? '#ffffff' : '#2563eb' }} />
              <span>{isUsingLiveGps ? 'Live GPS: Active' : 'Live Device GPS'}</span>
            </button>

            <button
              type="button"
              onClick={handleFocusVehicle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                fontSize: 12,
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
              title={isAtOrigin ? 'Focus on patient at home' : 'Track and zoom to patient vehicle'}
            >
              {isAtOrigin ? <Home size={15} style={{ color: '#2563eb' }} /> : <Car size={15} style={{ color: '#059669' }} />}
              <span>{isAtOrigin ? 'Locate Patient' : 'Track Car'}</span>
            </button>

            <button
              type="button"
              onClick={handleRecenterRoute}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                fontSize: 12,
                fontWeight: 600,
                color: '#0f172a',
                cursor: 'pointer',
              }}
              title="View entire transit corridor"
            >
              <Maximize2 size={14} style={{ color: '#2563eb' }} />
              <span>Full Route</span>
            </button>
          </div>
        </div>

        {/* ── FLOATING BOTTOM-LEFT PATIENT & ROUTE CARD (SHOWS PATIENT PHOTO) ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            maxWidth: 390,
            width: 'calc(100% - 28px)',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            padding: '14px 16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 500,
            pointerEvents: 'auto',
          }}
        >
          {/* Header with patient portrait & expand toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedInfo ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2.5px solid #2563eb',
                  boxShadow: '0 3px 10px rgba(37,99,235,0.25)',
                  flexShrink: 0,
                  background: '#f1f5f9',
                }}
              >
                <img
                  src={patientPhotoUrl}
                  alt={pName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackAvatarUrl;
                  }}
                />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  {pName}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                  Appointment #{aptId} · {isAtOrigin ? 'Stationary at Home' : (isArrived ? 'Arrived' : 'In Transit')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandedInfo(!expandedInfo)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: '#2563eb',
              }}
            >
              {expandedInfo ? 'Minimize' : 'Details'}
            </button>
          </div>

          {expandedInfo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              {/* Route Waypoints */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                {/* Origin */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#2563eb', border: '2px solid #ffffff', boxShadow: '0 0 4px #2563eb', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {isUsingLiveGps ? 'Live GPS Device Position' : 'Patient Origin Address'}
                    </span>
                    <p style={{ margin: '1px 0 0', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                      {isUsingLiveGps && liveGpsCoords
                        ? `Lat ${liveGpsCoords.lat.toFixed(5)}, Lng ${liveGpsCoords.lng.toFixed(5)} (±${Math.round(liveGpsAccuracy || 0)}m)`
                        : pAddress}
                    </p>
                  </div>
                </div>

                {/* Destination */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#dc2626', border: '2px solid #ffffff', boxShadow: '0 0 4px #dc2626', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      Destination Clinic
                    </span>
                    <p style={{ margin: '1px 0 0', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                      {hospitalInfo?.hospitalName || 'MediBook Central Clinic'}
                    </p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b' }}>
                      {hospitalInfo?.address || 'Metro Manila, Philippines'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transit Status Badge & Actions */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {pPhone && (
                  <a
                    href={`tel:${pPhone}`}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#f1f5f9',
                      color: '#0f172a',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Phone size={13} style={{ color: '#059669' }} />
                    <span>Call ({pPhone})</span>
                  </a>
                )}

                {/* Quick Toggle On The Way */}
                {isAtOrigin ? (
                  <button
                    type="button"
                    onClick={() => updateTransitProgress(0.25)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(5, 150, 105, 0.1)',
                      color: '#059669',
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid rgba(5, 150, 105, 0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <Car size={13} />
                    <span>Start Transit</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateTransitProgress(0)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#f8fafc',
                      color: '#64748b',
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    <Home size={13} />
                    <span>Reset to Home</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FLOATING BOTTOM-RIGHT TRANSIT STATUS & TELEMATICS CONTROLS ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            padding: '12px 14px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 500,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 390,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Transit & Telematics Status:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isAtOrigin ? '#d97706' : (isArrived ? '#059669' : '#2563eb'),
                }}
              >
                {isAtOrigin ? 'Not Yet On The Way (0%)' : `${Math.round(transitProgress * 100)}% En Route`}
              </span>

              {/* Simulation Auto Play/Pause */}
              <button
                type="button"
                onClick={() => setIsSimulating(!isSimulating)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: isSimulating ? 'rgba(239, 68, 68, 0.1)' : '#f8fafc',
                  color: isSimulating ? '#ef4444' : '#334155',
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title={isSimulating ? 'Pause transit auto-simulation' : 'Play simulated vehicle movement along road'}
              >
                {isSimulating ? <Pause size={10} /> : <Play size={10} />}
                <span>{isSimulating ? 'Pause' : 'Simulate'}</span>
              </button>
            </div>
          </div>

          {/* Quick Status Buttons including 0% Not Departed */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { label: '0% At Home', val: 0, isHome: true },
              { label: '25% Departed', val: 0.25 },
              { label: '50% Halfway', val: 0.5 },
              { label: '80% Near', val: 0.8 },
              { label: '100% Arrived', val: 1.0 },
            ].map((btn) => {
              const active = transitProgress === btn.val;
              return (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => updateTransitProgress(btn.val)}
                  style={{
                    padding: '5px 7px',
                    borderRadius: 7,
                    border: '1px solid',
                    borderColor: active ? (btn.isHome ? '#d97706' : '#059669') : '#cbd5e1',
                    background: active ? (btn.isHome ? '#d97706' : '#059669') : '#f8fafc',
                    color: active ? '#ffffff' : '#334155',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flex: 1,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Compact Legend Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b', paddingTop: 4, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
              Patient Live Origin
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
              Active Route
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              Clinic
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
