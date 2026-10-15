'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Check, Loader2 } from 'lucide-react';

export interface PhAddressValue {
  region?: string;
  regionCode?: string;
  province?: string;
  provinceCode?: string;
  city?: string;
  cityCode?: string;
  barangay?: string;
  barangayCode?: string;
  street?: string;
  fullAddress: string;
}

interface RegionItem {
  id: number;
  psgc_code: string;
  region_name: string;
  region_code: string;
}

interface ProvinceItem {
  province_code: string;
  province_name: string;
  psgc_code: string;
  region_code: string;
}

interface CityItem {
  city_code: string;
  city_name: string;
  province_code: string;
  psgc_code: string;
  region_desc: string;
}

interface BarangayItem {
  code: string;
  name: string;
}

interface PhilippineAddressSelectorProps {
  value?: string;
  onChange: (fullAddress: string, details?: PhAddressValue) => void;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}

export default function PhilippineAddressSelector({
  value = '',
  onChange,
  required = false,
  disabled = false,
  compact = false,
  label = 'Address (Philippines)',
}: PhilippineAddressSelectorProps) {
  // Master lists
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [allProvinces, setAllProvinces] = useState<ProvinceItem[]>([]);
  const [allCities, setAllCities] = useState<CityItem[]>([]);
  const [filteredProvinces, setFilteredProvinces] = useState<ProvinceItem[]>([]);
  const [filteredCities, setFilteredCities] = useState<CityItem[]>([]);
  const [barangays, setBarangays] = useState<BarangayItem[]>([]);

  // Selected codes and names
  const [selectedRegionCode, setSelectedRegionCode] = useState<string>('');
  const [selectedRegionName, setSelectedRegionName] = useState<string>('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>('');
  const [selectedCityCode, setSelectedCityCode] = useState<string>('');
  const [selectedCityName, setSelectedCityName] = useState<string>('');
  const [selectedBarangayName, setSelectedBarangayName] = useState<string>('');
  const [streetAddress, setStreetAddress] = useState<string>('');

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const initialParsedRef = useRef(false);

  // Load regions, provinces, cities on mount
  useEffect(() => {
    let mounted = true;
    setLoadingRegions(true);

    Promise.all([
      fetch('/ph-address/region.json').then((r) => r.json()),
      fetch('/ph-address/province.json').then((r) => r.json()),
      fetch('/ph-address/city.json').then((r) => r.json()),
    ])
      .then(([regData, provData, cityData]) => {
        if (!mounted) return;
        setRegions(regData || []);
        setAllProvinces(provData || []);
        setAllCities(cityData || []);
      })
      .catch((err) => {
        console.error('Failed to load PH address data:', err);
      })
      .finally(() => {
        if (mounted) setLoadingRegions(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Handle region change
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedRegionCode(code);
    const regObj = regions.find((r) => r.region_code === code);
    const regName = regObj ? regObj.region_name : '';
    setSelectedRegionName(regName);

    // Reset downstream
    setSelectedProvinceCode('');
    setSelectedProvinceName('');
    setSelectedCityCode('');
    setSelectedCityName('');
    setSelectedBarangayName('');
    setBarangays([]);

    if (code) {
      const provs = allProvinces.filter((p) => p.region_code === code);
      setFilteredProvinces(provs);
      setFilteredCities([]);
    } else {
      setFilteredProvinces([]);
      setFilteredCities([]);
    }
  };

  // Handle province change
  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedProvinceCode(code);
    const provObj = filteredProvinces.find((p) => p.province_code === code);
    const provName = provObj ? provObj.province_name : '';
    setSelectedProvinceName(provName);

    // Reset downstream
    setSelectedCityCode('');
    setSelectedCityName('');
    setSelectedBarangayName('');
    setBarangays([]);

    if (code) {
      const cities = allCities.filter((c) => c.province_code === code);
      setFilteredCities(cities);
    } else {
      setFilteredCities([]);
    }
  };

  // Handle city change & fetch split barangay JSON
  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCityCode(code);
    const cityObj = filteredCities.find((c) => c.city_code === code);
    const cityName = cityObj ? cityObj.city_name : '';
    setSelectedCityName(cityName);

    // Reset downstream
    setSelectedBarangayName('');
    setBarangays([]);

    if (code) {
      setLoadingBarangays(true);
      try {
        const res = await fetch(`/ph-address/barangays/${code}.json`);
        if (res.ok) {
          const brgyList: BarangayItem[] = await res.json();
          setBarangays(brgyList);
        } else {
          // Fallback if split file not found, try reading master
          const masterRes = await fetch('/ph-address/barangay.json');
          const allBrgy = await masterRes.json();
          const filtered = allBrgy
            .filter((b: any) => b.city_code === code)
            .map((b: any) => ({ code: b.brgy_code, name: b.brgy_name }));
          setBarangays(filtered);
        }
      } catch (err) {
        console.error('Failed to load barangays for city ' + code, err);
        setBarangays([]);
      } finally {
        setLoadingBarangays(false);
      }
    }
  };

  // Compute full address when selections change
  useEffect(() => {
    if (manualMode) return;
    if (!selectedRegionName && !streetAddress) return;

    const parts: string[] = [];
    if (streetAddress.trim()) parts.push(streetAddress.trim());
    if (selectedBarangayName) parts.push(`Brgy. ${selectedBarangayName}`);
    if (selectedCityName) parts.push(selectedCityName);
    if (selectedProvinceName) parts.push(selectedProvinceName);
    if (selectedRegionName) parts.push(selectedRegionName);
    parts.push('Philippines');

    const full = parts.filter(Boolean).join(', ');
    if (full !== value && full !== 'Philippines') {
      onChange(full, {
        region: selectedRegionName,
        regionCode: selectedRegionCode,
        province: selectedProvinceName,
        provinceCode: selectedProvinceCode,
        city: selectedCityName,
        cityCode: selectedCityCode,
        barangay: selectedBarangayName,
        street: streetAddress,
        fullAddress: full,
      });
    }
  }, [
    manualMode,
    streetAddress,
    selectedBarangayName,
    selectedCityName,
    selectedProvinceName,
    selectedRegionName,
    selectedRegionCode,
    selectedProvinceCode,
    selectedCityCode,
  ]);

  return (
    <div className="ph-address-selector space-y-3">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <MapPin size={14} style={{ color: 'var(--primary)' }} />
          <span>{label}</span>
          {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
        </label>
        <button
          type="button"
          onClick={() => setManualMode(!manualMode)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '2px 4px',
            textDecoration: 'underline',
          }}
        >
          {manualMode ? 'Switch to PSGC Standard Selector' : 'Manual Address Input'}
        </button>
      </div>

      {manualMode ? (
        <textarea
          className="form-input"
          rows={2}
          placeholder="Enter complete address manually (e.g. 123 Rizal St, Brgy. Central, Quezon City, Metro Manila, Philippines)…"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Dropdowns Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
            }}
          >
            {/* Region Dropdown */}
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>
                Region {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-input text-xs"
                  value={selectedRegionCode}
                  onChange={handleRegionChange}
                  disabled={disabled || loadingRegions}
                  style={{ width: '100%', paddingRight: 28 }}
                >
                  <option value="">{loadingRegions ? 'Loading regions…' : '— Select Region —'}</option>
                  {regions.map((r) => (
                    <option key={`reg-${r.region_code}`} value={r.region_code}>
                      {r.region_name}
                    </option>
                  ))}
                </select>
                {loadingRegions && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                    style={{ position: 'absolute', right: 10, top: 12, color: 'var(--muted)' }}
                  />
                )}
              </div>
            </div>

            {/* Province Dropdown */}
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>
                Province {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
              </label>
              <select
                className="form-input text-xs"
                value={selectedProvinceCode}
                onChange={handleProvinceChange}
                disabled={disabled || !selectedRegionCode || filteredProvinces.length === 0}
                style={{ width: '100%' }}
              >
                <option value="">
                  {!selectedRegionCode
                    ? 'Select region first'
                    : filteredProvinces.length === 0
                    ? 'No province found'
                    : '— Select Province —'}
                </option>
                {filteredProvinces.map((p) => (
                  <option key={`prov-${p.province_code}`} value={p.province_code}>
                    {p.province_name}
                  </option>
                ))}
              </select>
            </div>

            {/* City / Municipality Dropdown */}
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>
                City / Municipality {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
              </label>
              <select
                className="form-input text-xs"
                value={selectedCityCode}
                onChange={handleCityChange}
                disabled={disabled || !selectedProvinceCode || filteredCities.length === 0}
                style={{ width: '100%' }}
              >
                <option value="">
                  {!selectedProvinceCode
                    ? 'Select province first'
                    : filteredCities.length === 0
                    ? 'No cities found'
                    : '— Select City / Municipality —'}
                </option>
                {filteredCities.map((c) => (
                  <option key={`city-${c.city_code}`} value={c.city_code}>
                    {c.city_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Barangay Dropdown */}
            <div>
              <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>
                Barangay {required && <span style={{ color: 'var(--danger-text)' }}>*</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-input text-xs"
                  value={selectedBarangayName}
                  onChange={(e) => setSelectedBarangayName(e.target.value)}
                  disabled={disabled || !selectedCityCode || loadingBarangays}
                  style={{ width: '100%', paddingRight: 28 }}
                >
                  <option value="">
                    {loadingBarangays
                      ? 'Loading barangays…'
                      : !selectedCityCode
                      ? 'Select city first'
                      : barangays.length === 0
                      ? 'No barangays found'
                      : '— Select Barangay —'}
                  </option>
                  {barangays.map((b) => (
                    <option key={`brgy-${b.code}`} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {loadingBarangays && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                    style={{ position: 'absolute', right: 10, top: 12, color: 'var(--muted)' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Street / Building Details */}
          <div>
            <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>
              House / Unit / Block / Street / Subdivision
            </label>
            <input
              type="text"
              className="form-input text-xs"
              placeholder="e.g. Unit 402 Medical Plaza, 25 Orchid St., Villa Verde"
              value={streetAddress}
              disabled={disabled}
              onChange={(e) => setStreetAddress(e.target.value)}
            />
          </div>

          {/* Formatted Preview */}
          {value && value.trim() && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                fontSize: 12,
              }}
            >
              <Check size={14} style={{ color: 'var(--success)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <span className="text-muted" style={{ fontWeight: 600 }}>Standardized Address: </span>
                <span style={{ color: 'var(--foreground)' }}>{value}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
