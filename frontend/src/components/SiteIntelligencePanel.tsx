import { useEffect, useState, useCallback } from 'react'
import {
  X, RefreshCw, Loader, MapPin, Building2, Sun, Wind,
  Droplets, Activity, Train, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Zap, Shield, TreePine, FlaskConical,
} from 'lucide-react'
import { getIntelligence } from '../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Intel {
  status: string
  planning_summary?: string
  address_details?: {
    display_name?: string; city?: string; county?: string; state?: string
    state_abbr?: string; country?: string; country_code?: string; postcode?: string
  }
  elevation_data?: { elevation_m?: number; elevation_ft?: number }
  sun_data?: {
    today?: { sunrise?: string; sunset?: string; day_length?: string; solar_noon?: string }
    summer_solstice?: { sunrise?: string; sunset?: string; day_length?: string }
    winter_solstice?: { sunrise?: string; sunset?: string; day_length?: string }
    spring_equinox?: { sunrise?: string; sunset?: string; day_length?: string }
  }
  climate_data?: {
    timezone?: string; current_temp_c?: number; current_temp_f?: number
    current_humidity_pct?: number; current_wind_kmh?: number; current_wind_dir?: string
    weekly_avg_high_c?: number; weekly_avg_high_f?: number
    weekly_avg_low_c?: number; weekly_avg_low_f?: number
    weekly_total_precip_mm?: number; weekly_max_wind_kmh?: number
  }
  air_quality_data?: { us_aqi?: number; aqi_label?: string; pm2_5_ugm3?: number; pm10_ugm3?: number }
  flood_data?: { zone?: string; risk?: string; description?: string; sfha?: boolean }
  nearby_infrastructure?: {
    hospitals?: Array<{ name: string; type: string }>
    hospital_count?: number
    transit?: Array<{ name: string; type: string }>
    transit_count?: number
    major_roads?: Array<{ name: string; type: string }>
    emergency?: Array<{ name: string; type: string }>
    road_count?: number
  }
  zoning?: {
    likely_zone?: string; permitted_uses?: string[]; conditional_uses?: string[]
    notes?: string; density_notes?: string
  }
  building_restrictions?: {
    max_height_m?: number; max_height_stories?: number; max_far?: number
    min_setback_front_m?: number; min_setback_side_m?: number; min_setback_rear_m?: number
    lot_coverage_max_pct?: number; parking_ratio?: string; notes?: string
  }
  building_codes?: {
    primary_code?: string; state_adopted_code?: string; fire_code?: string
    energy_code?: string; ashrae_climate_zone?: string; ashrae_climate_description?: string
    seismic_design_category?: string; wind_exposure_category?: string
    snow_load_applicable?: boolean; electrical_code?: string; plumbing_code?: string
  }
  healthcare_constraints?: {
    fgi_version?: string; state_adopts_fgi?: boolean; state_health_authority?: string
    certificate_of_need_required?: boolean; con_scope?: string
    key_fgi_requirements?: string[]; infection_control_zones?: string
    emergency_power?: string; notes?: string
  }
  environmental?: {
    solar_orientation?: string; prevailing_wind?: string; noise_sources?: string
    sustainability_code?: string; utility_intensity?: string; stormwater_notes?: string
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-panel hover:bg-card transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-accent">{icon}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
      </button>
      {open && <div className="px-5 py-4 bg-surface/50 space-y-3">{children}</div>}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value?: string | number | null; sub?: string; color?: string }) {
  if (value === undefined || value === null) return null
  return (
    <div className="bg-panel rounded-lg px-3 py-2.5">
      <div className={`text-sm font-semibold ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  )
}

function Tag({ text, color }: { text: string; color?: string }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${color || 'border-border text-muted bg-surface'}`}>
      {text}
    </span>
  )
}

function Row({ label, value }: { label: string; value?: string | number | null | boolean }) {
  if (value === undefined || value === null) return null
  const display = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted flex-none w-40">{label}</span>
      <span className="text-xs text-white text-right flex-1">{display}</span>
    </div>
  )
}

function AQIBadge({ aqi, label }: { aqi?: number; label?: string }) {
  const color =
    aqi === undefined ? 'text-muted border-border' :
    aqi <= 50 ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
    aqi <= 100 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
    aqi <= 150 ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' :
    'text-red-400 border-red-400/30 bg-red-400/10'
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${color}`}>
      <span>{aqi ?? '?'}</span>
      <span className="text-xs font-normal">{label || 'AQI'}</span>
    </div>
  )
}

function FloodBadge({ zone, risk }: { zone?: string; risk?: string }) {
  const high = risk?.includes('High')
  const mod = risk?.includes('Moderate')
  const color = high ? 'text-red-400 border-red-400/30 bg-red-400/10' :
    mod ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
    'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${color}`}>
      {high ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
      <span>Zone {zone || '?'}</span>
      <span className="text-xs font-normal">— {risk || '?'}</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[120, 80, 100, 90, 110].map((h, i) => (
        <div key={i} className="bg-panel rounded-xl" style={{ height: h }} />
      ))}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function SiteIntelligencePanel({ isOpen, onClose, projectId }: Props) {
  const [intel, setIntel] = useState<Intel | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await getIntelligence(projectId)
      setIntel(data)
      return data.status
    } catch {
      return 'error'
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      const status = await load()
      if (status === 'pending' || status === 'processing') {
        timer = setTimeout(poll, 3000)
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [isOpen, load])

  if (!isOpen) return null

  const addr = intel?.address_details
  const elev = intel?.elevation_data
  const sun = intel?.sun_data
  const climate = intel?.climate_data
  const aq = intel?.air_quality_data
  const flood = intel?.flood_data
  const nearby = intel?.nearby_infrastructure
  const zoning = intel?.zoning
  const br = intel?.building_restrictions
  const bc = intel?.building_codes
  const hc = intel?.healthcare_constraints
  const env = intel?.environmental

  const isProcessing = !intel || intel.status === 'pending' || intel.status === 'processing'
  const isFailed = intel?.status === 'failed'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-[680px] max-w-full bg-surface border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex-none px-6 py-5 border-b border-border bg-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={16} className="text-accent" />
                <span className="text-white font-semibold">Site Intelligence</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  isProcessing ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
                  isFailed ? 'text-red-400 border-red-400/30 bg-red-400/10' :
                  'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                }`}>
                  {isProcessing ? '⟳ Analyzing…' : isFailed ? '⚠ Partial data' : '✓ Complete'}
                </span>
              </div>
              {addr?.display_name && (
                <p className="text-xs text-muted leading-relaxed max-w-md">{addr.display_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setLoading(true); load() }}
                className="p-2 text-muted hover:text-white rounded-lg hover:bg-border transition-colors"
                title="Refresh"
              >
                <RefreshCw size={15} />
              </button>
              <button onClick={onClose} className="p-2 text-muted hover:text-white rounded-lg hover:bg-border transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading && !intel ? (
            <Skeleton />
          ) : isProcessing ? (
            <div>
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-4 mb-4">
                <Loader size={18} className="text-yellow-400 animate-spin flex-none" />
                <div>
                  <p className="text-yellow-300 text-sm font-medium">Gathering site data…</p>
                  <p className="text-yellow-400/70 text-xs mt-0.5">
                    Pulling elevation, sun angles, flood zones, air quality, nearby infrastructure, and synthesizing building codes via AI
                  </p>
                </div>
              </div>
              <Skeleton />
            </div>
          ) : (
            <>
              {/* AI Planning Summary */}
              {intel?.planning_summary && (
                <div className="bg-accent/10 border border-accent/20 rounded-xl px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={14} className="text-accent" />
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Planning Summary</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{intel.planning_summary}</p>
                </div>
              )}

              {/* Location Overview */}
              <Section icon={<MapPin size={16} />} title="Location Overview">
                <div className="grid grid-cols-3 gap-2">
                  {elev?.elevation_m !== undefined && (
                    <Stat label="Elevation" value={`${elev.elevation_m}m`} sub={`${elev.elevation_ft} ft`} />
                  )}
                  {climate?.current_temp_c !== undefined && (
                    <Stat label="Current Temp" value={`${climate.current_temp_c}°C`} sub={`${climate.current_temp_f}°F`} />
                  )}
                  {climate?.timezone && (
                    <Stat label="Timezone" value={climate.timezone.split('/').pop()?.replace('_', ' ')} />
                  )}
                  {bc?.ashrae_climate_zone && (
                    <Stat label="ASHRAE Zone" value={bc.ashrae_climate_zone} sub={bc.ashrae_climate_description} color="text-blue-300" />
                  )}
                  {addr?.county && <Stat label="County" value={addr.county} />}
                  {addr?.postcode && <Stat label="Postal Code" value={addr.postcode} />}
                </div>
              </Section>

              {/* Zoning */}
              <Section icon={<Building2 size={16} />} title="Zoning & Land Use">
                {zoning?.likely_zone && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-accent/20 border border-accent/30 rounded-lg px-4 py-2.5">
                      <div className="text-lg font-bold text-accent">{zoning.likely_zone}</div>
                      <div className="text-xs text-muted">Likely Zone Classification</div>
                    </div>
                  </div>
                )}
                {zoning?.permitted_uses && zoning.permitted_uses.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-muted mb-1.5">Permitted Uses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {zoning.permitted_uses.map(u => <Tag key={u} text={u} color="border-emerald-500/30 text-emerald-400 bg-emerald-500/10" />)}
                    </div>
                  </div>
                )}
                {zoning?.conditional_uses && zoning.conditional_uses.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-muted mb-1.5">Conditional Uses</p>
                    <div className="flex flex-wrap gap-1.5">
                      {zoning.conditional_uses.map(u => <Tag key={u} text={u} color="border-yellow-500/30 text-yellow-400 bg-yellow-500/10" />)}
                    </div>
                  </div>
                )}
                {zoning?.notes && <p className="text-xs text-muted leading-relaxed mt-2 pt-2 border-t border-border/50">{zoning.notes}</p>}
              </Section>

              {/* Building Restrictions */}
              <Section icon={<Building2 size={16} />} title="Building Restrictions">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {br?.max_height_m && <Stat label="Max Height" value={`${br.max_height_m}m`} sub={br.max_height_stories ? `${br.max_height_stories} stories` : undefined} />}
                  {br?.max_far && <Stat label="Max FAR" value={br.max_far} />}
                  {br?.lot_coverage_max_pct && <Stat label="Max Lot Coverage" value={`${br.lot_coverage_max_pct}%`} />}
                </div>
                <div className="space-y-0">
                  <Row label="Front Setback" value={br?.min_setback_front_m ? `${br.min_setback_front_m}m` : null} />
                  <Row label="Side Setback" value={br?.min_setback_side_m ? `${br.min_setback_side_m}m` : null} />
                  <Row label="Rear Setback" value={br?.min_setback_rear_m ? `${br.min_setback_rear_m}m` : null} />
                  <Row label="Parking" value={br?.parking_ratio} />
                </div>
                {br?.notes && <p className="text-xs text-muted leading-relaxed mt-2 pt-2 border-t border-border/50">{br.notes}</p>}
              </Section>

              {/* Building Codes */}
              <Section icon={<Shield size={16} />} title="Building Codes">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {bc?.ashrae_climate_zone && <Stat label="ASHRAE Climate" value={bc.ashrae_climate_zone} sub={bc.ashrae_climate_description} color="text-blue-300" />}
                  {bc?.seismic_design_category && <Stat label="Seismic SDC" value={`SDC ${bc.seismic_design_category}`} />}
                  {bc?.wind_exposure_category && <Stat label="Wind Exposure" value={`Category ${bc.wind_exposure_category}`} />}
                  {bc?.snow_load_applicable !== undefined && <Stat label="Snow Load" value={bc.snow_load_applicable ? 'Applicable' : 'Not Applicable'} />}
                </div>
                <div className="space-y-0">
                  <Row label="Building Code" value={bc?.primary_code} />
                  <Row label="State Code" value={bc?.state_adopted_code} />
                  <Row label="Fire / Life Safety" value={bc?.fire_code} />
                  <Row label="Energy Code" value={bc?.energy_code} />
                  <Row label="Electrical" value={bc?.electrical_code} />
                  <Row label="Plumbing" value={bc?.plumbing_code} />
                </div>
              </Section>

              {/* Sun & Daylight */}
              <Section icon={<Sun size={16} />} title="Sun & Daylight">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Today', data: sun?.today },
                    { label: 'Summer Solstice (Jun 21)', data: sun?.summer_solstice },
                    { label: 'Winter Solstice (Dec 21)', data: sun?.winter_solstice },
                    { label: 'Spring Equinox (Mar 21)', data: sun?.spring_equinox },
                  ].filter(d => d.data?.sunrise).map(({ label, data }) => (
                    <div key={label} className="bg-panel rounded-lg px-3 py-2.5">
                      <p className="text-xs text-muted mb-1.5">{label}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-yellow-400">↑ {data?.sunrise}</span>
                        <span className="text-orange-400">↓ {data?.sunset}</span>
                      </div>
                      {data?.day_length && <p className="text-xs text-muted mt-1">{data.day_length} day length</p>}
                    </div>
                  ))}
                </div>
                {env?.solar_orientation && (
                  <div className="mt-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-3">
                    <p className="text-xs font-medium text-yellow-300 mb-0.5">Optimal Orientation</p>
                    <p className="text-xs text-yellow-200/80">{env.solar_orientation}</p>
                  </div>
                )}
              </Section>

              {/* Environmental */}
              <Section icon={<TreePine size={16} />} title="Environmental">
                <div className="flex flex-wrap gap-3 mb-3">
                  {flood?.zone && <FloodBadge zone={flood.zone} risk={flood.risk} />}
                  {aq?.us_aqi !== undefined && <AQIBadge aqi={aq.us_aqi} label={aq.aqi_label} />}
                </div>
                {flood?.description && (
                  <div className="bg-panel rounded-lg px-3 py-2.5 mb-2">
                    <p className="text-xs text-muted mb-0.5">Flood Zone Description</p>
                    <p className="text-xs text-white">{flood.description}</p>
                    {flood.sfha && <p className="text-xs text-red-400 mt-1">Special Flood Hazard Area (SFHA) — flood insurance required</p>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {aq?.pm2_5_ugm3 !== undefined && <Stat label="PM2.5" value={`${aq.pm2_5_ugm3} µg/m³`} />}
                  {aq?.pm10_ugm3 !== undefined && <Stat label="PM10" value={`${aq.pm10_ugm3} µg/m³`} />}
                  {climate?.current_humidity_pct !== undefined && <Stat label="Humidity" value={`${climate.current_humidity_pct}%`} />}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {climate?.weekly_avg_high_c !== undefined && (
                    <Stat label="Weekly High" value={`${climate.weekly_avg_high_c}°C / ${climate.weekly_avg_high_f}°F`} />
                  )}
                  {climate?.weekly_avg_low_c !== undefined && (
                    <Stat label="Weekly Low" value={`${climate.weekly_avg_low_c}°C / ${climate.weekly_avg_low_f}°F`} />
                  )}
                  {climate?.current_wind_kmh !== undefined && (
                    <Stat label="Wind" value={`${climate.current_wind_kmh} km/h ${climate.current_wind_dir || ''}`} />
                  )}
                  {climate?.weekly_total_precip_mm !== undefined && (
                    <Stat label="7-Day Precipitation" value={`${climate.weekly_total_precip_mm} mm`} />
                  )}
                </div>
                {env?.prevailing_wind && (
                  <div className="mt-2 text-xs text-muted pt-2 border-t border-border/50">
                    <strong className="text-white">Prevailing Wind:</strong> {env.prevailing_wind}
                  </div>
                )}
                {env?.noise_sources && (
                  <div className="mt-1 text-xs text-muted">
                    <strong className="text-white">Noise Sources:</strong> {env.noise_sources}
                  </div>
                )}
                {env?.stormwater_notes && (
                  <div className="mt-1 text-xs text-muted">
                    <strong className="text-white">Stormwater:</strong> {env.stormwater_notes}
                  </div>
                )}
              </Section>

              {/* Nearby Infrastructure */}
              <Section icon={<Train size={16} />} title="Nearby Infrastructure">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Stat label="Hospitals/Clinics" value={nearby?.hospital_count} sub="within 2 km" color={nearby?.hospital_count ? 'text-emerald-400' : 'text-white'} />
                  <Stat label="Transit Stops" value={nearby?.transit_count} sub="within 1.2 km" />
                  <Stat label="Major Roads" value={nearby?.road_count} sub="within 700m" />
                </div>
                {nearby?.hospitals && nearby.hospitals.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted mb-1.5">Healthcare Facilities</p>
                    <div className="space-y-1">
                      {nearby.hospitals.slice(0, 6).map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
                          <span className="text-white">{h.name}</span>
                          <span className="text-muted capitalize ml-auto">{h.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {nearby?.transit && nearby.transit.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted mb-1.5">Transit</p>
                    <div className="space-y-1">
                      {nearby.transit.slice(0, 6).map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-none" />
                          <span className="text-white">{t.name}</span>
                          <span className="text-muted capitalize ml-auto">{t.type.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {nearby?.major_roads && nearby.major_roads.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-1.5">Major Roads</p>
                    <div className="flex flex-wrap gap-1.5">
                      {nearby.major_roads.map((r, i) => (
                        <Tag key={i} text={r.name} color="border-border text-slate-300 bg-panel" />
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Healthcare & FGI */}
              <Section icon={<FlaskConical size={16} />} title="Healthcare Planning & FGI Guidelines">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {hc?.fgi_version && <Stat label="FGI Version" value={hc.fgi_version} color="text-purple-300" />}
                  {hc?.state_adopts_fgi !== undefined && (
                    <Stat label="State Adopts FGI" value={hc.state_adopts_fgi ? 'Yes' : 'No'} color={hc.state_adopts_fgi ? 'text-emerald-400' : 'text-yellow-400'} />
                  )}
                  {hc?.certificate_of_need_required !== undefined && (
                    <Stat label="CON Required" value={hc.certificate_of_need_required ? 'Yes' : 'No'} color={hc.certificate_of_need_required ? 'text-yellow-400' : 'text-emerald-400'} />
                  )}
                  {hc?.state_health_authority && <Stat label="Health Authority" value={hc.state_health_authority} />}
                </div>
                {hc?.con_scope && (
                  <div className="mb-3 text-xs text-muted">
                    <strong className="text-white">CON Scope:</strong> {hc.con_scope}
                  </div>
                )}
                {hc?.key_fgi_requirements && hc.key_fgi_requirements.length > 0 && (
                  <div>
                    <p className="text-xs text-muted mb-2">Key FGI Requirements</p>
                    <div className="space-y-2">
                      {hc.key_fgi_requirements.map((req, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-none mt-0.5">
                            <span className="text-purple-400 text-xs font-bold">{i + 1}</span>
                          </div>
                          <span className="text-slate-300 leading-relaxed">{req}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hc?.infection_control_zones && (
                  <div className="mt-3 bg-panel rounded-lg px-3 py-2.5">
                    <p className="text-xs text-muted mb-0.5">Infection Control Zones</p>
                    <p className="text-xs text-white">{hc.infection_control_zones}</p>
                  </div>
                )}
                {hc?.emergency_power && (
                  <div className="mt-2 bg-panel rounded-lg px-3 py-2.5">
                    <p className="text-xs text-muted mb-0.5">Emergency Power</p>
                    <p className="text-xs text-white">{hc.emergency_power}</p>
                  </div>
                )}
              </Section>

              {/* Sustainability */}
              {(env?.sustainability_code || env?.utility_intensity) && (
                <Section icon={<Zap size={16} />} title="Sustainability & Utilities" defaultOpen={false}>
                  <Row label="Sustainability Code" value={env.sustainability_code} />
                  <Row label="Utility Intensity" value={env.utility_intensity} />
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-none px-6 py-3 border-t border-border bg-panel flex items-center justify-between">
          <p className="text-xs text-muted">Data: Nominatim · OpenTopoData · Open-Meteo · FEMA · OSM · OpenAI</p>
          <p className="text-xs text-muted">For planning reference only</p>
        </div>
      </div>
    </>
  )
}
