import { hospitalInformationApi } from './api';
import type { HospitalInformation, GeocodeResult, NearbyByAddressResult } from './types';

/**
 * Geocodes an address string using OpenStreetMap Nominatim.
 * Uses the backend API endpoint first; falls back to direct Nominatim if needed.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const query = address.trim();
  if (!query) {
    return { found: false, message: 'Please enter an address.' };
  }

  // 1. Try backend API geocode
  try {
    const res = await hospitalInformationApi.geocode(query);
    const data = res.data;
    if (data?.found && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return {
        found: true,
        address: query,
        latitude: data.latitude,
        longitude: data.longitude,
        displayName: data.displayName || data.display_name || query,
      };
    }
  } catch {
    // Backend API failed or unauthenticated, fallback to direct OSM Nominatim
  }

  // 2. Direct browser fetch fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return {
            found: true,
            address: query,
            latitude: lat,
            longitude: lon,
            displayName: item.display_name || query,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Direct Nominatim geocoding failed:', err);
  }

  return { found: false, message: 'Could not find coordinates for this address.' };
}

/**
 * Automatically detects nearby hospitals for a patient's or facility's address.
 */
export async function getNearbyHospitalsForAddress(
  address: string,
  radius = 0
): Promise<NearbyByAddressResult> {
  const query = address.trim();
  if (!query) {
    return {
      found: false,
      address: '',
      message: 'Address is empty.',
      hospitals: [],
    };
  }

  // 1. Try backend nearby-by-address endpoint
  try {
    const res = await hospitalInformationApi.getNearbyByAddress(query, radius);
    const data = res.data;
    if (data?.found && Array.isArray(data.hospitals)) {
      return {
        found: true,
        address: query,
        latitude: data.latitude,
        longitude: data.longitude,
        displayName: data.displayName || data.display_name || query,
        hospitals: data.hospitals,
      };
    }
  } catch {
    // Fallback if backend route not reached
  }

  // 2. Manual fallback: geocode then get nearby
  const geo = await geocodeAddress(query);
  if (!geo.found || geo.latitude === undefined || geo.longitude === undefined) {
    return {
      found: false,
      address: query,
      message: geo.message || 'Could not locate address on OpenStreetMap.',
      hospitals: [],
    };
  }

  try {
    const nearbyRes = await hospitalInformationApi.getNearby(geo.latitude, geo.longitude, radius || 50);
    const items: HospitalInformation[] = Array.isArray(nearbyRes.data)
      ? nearbyRes.data
      : Array.isArray(nearbyRes.data?.items)
      ? nearbyRes.data.items
      : [];

    return {
      found: true,
      address: query,
      latitude: geo.latitude,
      longitude: geo.longitude,
      displayName: geo.displayName || query,
      hospitals: items,
    };
  } catch (err) {
    console.error('Failed to get nearby hospitals:', err);
    return {
      found: true,
      address: query,
      latitude: geo.latitude,
      longitude: geo.longitude,
      displayName: geo.displayName || query,
      hospitals: [],
    };
  }
}

/**
 * Format distance in km or meters for clean UI display.
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm)) {
    return 'Distance unknown';
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}
