import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toPng } from 'html-to-image'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Department {
  id: string; name: string; area_sqm: number; type: string
  zone?: string; beds?: number
}

interface BubbleData {
  id: string; version: number
  requirements_text?: string
  program_data?: {
    departments?: Department[]
    total_area_sqm?: number
    total_beds?: number
    summary?: string
  }
}

export interface IntelData {
  status?: string
  planning_summary?: string
  address_details?: {
    display_name?: string; city?: string; state?: string
    postcode?: string; county?: string
  }
  elevation_data?: { elevation_m?: number; elevation_ft?: number }
  zoning?: {
    likely_zone?: string; permitted_uses?: string[]
    conditional_uses?: string[]; notes?: string; density_notes?: string
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
    electrical_code?: string; plumbing_code?: string
  }
  healthcare_constraints?: {
    fgi_version?: string; state_adopts_fgi?: boolean; state_health_authority?: string
    certificate_of_need_required?: boolean; con_scope?: string
    key_fgi_requirements?: string[]
    infection_control_zones?: string; emergency_power?: string; notes?: string
  }
  environmental?: {
    solar_orientation?: string; prevailing_wind?: string; noise_sources?: string
    sustainability_code?: string; utility_intensity?: string; stormwater_notes?: string
  }
  flood_data?: { zone?: string; risk?: string; description?: string; sfha?: boolean }
  air_quality_data?: { us_aqi?: number; aqi_label?: string }
  climate_data?: {
    current_temp_c?: number; current_temp_f?: number
    current_humidity_pct?: number; current_wind_kmh?: number; current_wind_dir?: string
    weekly_avg_high_c?: number; weekly_avg_high_f?: number
    weekly_avg_low_c?: number; weekly_avg_low_f?: number
    weekly_total_precip_mm?: number
  }
  nearby_infrastructure?: {
    hospital_count?: number; transit_count?: number; road_count?: number
    hospitals?: Array<{ name: string; type: string }>
    transit?: Array<{ name: string; type: string }>
    major_roads?: Array<{ name: string; type: string }>
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_W = 210
const PAGE_H = 297
const M = 18        // margin
const CW = PAGE_W - M * 2  // content width
const ACCENT: [number, number, number] = [79, 110, 247]
const DARK: [number, number, number] = [25, 30, 55]
const GRAY: [number, number, number] = [110, 120, 145]
const LIGHT_BG: [number, number, number] = [245, 247, 255]

// ── PDF Builder helpers ────────────────────────────────────────────────────────

function makeBuilder(doc: jsPDF) {
  let y = M

  const checkBreak = (needed = 12) => {
    if (y + needed > PAGE_H - M) {
      doc.addPage()
      y = M
    }
    return y
  }

  const gap = (mm = 4) => { y += mm }

  const heading2 = (text: string) => {
    gap(6)
    checkBreak(14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(text.toUpperCase(), M, y)
    y += 1.5
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.4)
    doc.line(M, y, M + CW, y)
    y += 5
  }

  const label = (lbl: string, val: string | number | boolean | null | undefined, labelW = 58) => {
    if (val === undefined || val === null || val === '') return
    checkBreak(6.5)
    const display = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(lbl + ':', M, y)
    doc.setTextColor(40, 45, 70)
    const wrapped = doc.splitTextToSize(display, CW - labelW) as string[]
    doc.text(wrapped[0], M + labelW, y)
    y += 5.5
  }

  const bodyText = (text: string) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(50, 55, 80)
    const lines = doc.splitTextToSize(text, CW) as string[]
    lines.forEach(line => {
      checkBreak(5.5)
      doc.text(line, M, y)
      y += 5
    })
  }

  const bulletList = (items: string[]) => {
    items.forEach(item => {
      checkBreak(6)
      doc.setFontSize(8.5)
      doc.setTextColor(50, 55, 80)
      const lines = doc.splitTextToSize(item, CW - 6) as string[]
      doc.text('•', M, y)
      lines.forEach((l, i) => {
        checkBreak(5)
        doc.text(l, M + 5, y)
        y += 5
      })
    })
  }

  const getY = () => y
  const setY = (val: number) => { y = val }

  return { checkBreak, gap, heading2, label, bodyText, bulletList, getY, setY }
}

// ── Main export function ───────────────────────────────────────────────────────

export async function generateProjectPDF(
  projectName: string,
  bubble: BubbleData,
  intel: IntelData | null,
  canvasElement: HTMLElement | null,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const b = makeBuilder(doc)

  // ── PAGE 1: Header ────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG)
  doc.rect(0, 0, PAGE_W, 42, 'F')

  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ACCENT)
  doc.text('HealthArch', M, 17)

  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Project Planning Report', M, 26)

  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  doc.text(`${projectName}   ·   Generated ${dateStr}`, M, 34)

  if (intel?.address_details?.display_name) {
    const addrLine = doc.splitTextToSize(`Site: ${intel.address_details.display_name}`, CW) as string[]
    doc.text(addrLine[0], M, 40)
  }

  b.setY(52)

  // ── Facility Program ──────────────────────────────────────────────────────
  b.heading2('Facility Program')

  if (bubble.requirements_text) {
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('Requirements:', M, b.getY())
    b.setY(b.getY() + 4.5)
    b.bodyText(bubble.requirements_text)
    b.gap(2)
  }

  const prog = bubble.program_data
  if (prog) {
    const stats = [
      prog.total_area_sqm ? `Total Area: ${prog.total_area_sqm.toLocaleString()} m²` : null,
      prog.total_beds ? `Total Beds: ${prog.total_beds}` : null,
      prog.departments ? `Departments: ${prog.departments.length}` : null,
    ].filter(Boolean).join('   ·   ')

    if (stats) {
      b.checkBreak(8)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...DARK)
      doc.text(stats, M, b.getY())
      b.setY(b.getY() + 6)
    }

    if (prog.summary) {
      b.bodyText(prog.summary)
      b.gap(2)
    }

    if (prog.departments && prog.departments.length > 0) {
      b.checkBreak(22)
      const rows = prog.departments.map(d => [
        d.name,
        d.type.charAt(0).toUpperCase() + d.type.slice(1),
        d.area_sqm.toLocaleString(),
        d.beds ? String(d.beds) : '—',
        d.zone || '—',
      ])

      autoTable(doc, {
        head: [['Department', 'Type', 'Area (m²)', 'Beds', 'Zone']],
        body: rows,
        startY: b.getY(),
        margin: { left: M, right: M },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 249, 255] },
        columnStyles: {
          0: { cellWidth: 56 },
          2: { halign: 'right' as const },
          3: { halign: 'center' as const },
        },
      })
      b.setY((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5)
    }
  }

  // ── Bubble Diagram Screenshot ─────────────────────────────────────────────
  if (canvasElement) {
    try {
      const imgData = await toPng(canvasElement, {
        backgroundColor: '#1a1d2e',
        quality: 0.92,
        pixelRatio: 1.5,
        cacheBust: true,
      })

      const imgW = CW
      const imgH = Math.min(85, imgW * 0.5)
      b.checkBreak(imgH + 18)
      b.heading2('Bubble Diagram')
      doc.addImage(imgData, 'PNG', M, b.getY(), imgW, imgH)
      b.setY(b.getY() + imgH + 5)
    } catch (err) {
      console.warn('Could not capture diagram screenshot:', err)
    }
  }

  // ── PAGE 2: Site Intelligence ─────────────────────────────────────────────
  if (intel) {
    doc.addPage()
    b.setY(M)

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...ACCENT)
    doc.text('Site Intelligence Report', M, b.getY())
    b.setY(b.getY() + 10)

    // AI Planning Summary box
    if (intel.planning_summary) {
      b.checkBreak(22)
      const summaryLines = doc.splitTextToSize(intel.planning_summary, CW - 8) as string[]
      const boxH = summaryLines.length * 5 + 12
      doc.setFillColor(240, 243, 255)
      doc.roundedRect(M, b.getY(), CW, boxH, 2, 2, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...ACCENT)
      doc.text('AI Planning Summary', M + 4, b.getY() + 6)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 55, 80)
      summaryLines.forEach((line, i) => {
        doc.text(line, M + 4, b.getY() + 12 + i * 5)
      })
      b.setY(b.getY() + boxH + 6)
    }

    // Location
    b.heading2('Location Overview')
    if (intel.address_details?.display_name) b.bodyText(intel.address_details.display_name)
    b.label('County', intel.address_details?.county)
    b.label('Postal Code', intel.address_details?.postcode)
    const elev = intel.elevation_data
    b.label('Elevation', elev?.elevation_m != null ? `${elev.elevation_m}m / ${elev.elevation_ft} ft` : null)
    const bc = intel.building_codes
    b.label('ASHRAE Zone', bc?.ashrae_climate_zone ? `${bc.ashrae_climate_zone} — ${bc.ashrae_climate_description || ''}` : null)

    // Zoning
    if (intel.zoning) {
      b.heading2('Zoning & Land Use')
      b.label('Zone Classification', intel.zoning.likely_zone)
      b.label('Density Notes', intel.zoning.density_notes)
      if (intel.zoning.permitted_uses?.length) {
        doc.setFontSize(8); doc.setTextColor(...GRAY)
        doc.text('Permitted Uses:', M, b.getY()); b.setY(b.getY() + 4.5)
        b.bulletList(intel.zoning.permitted_uses)
      }
      if (intel.zoning.conditional_uses?.length) {
        doc.setFontSize(8); doc.setTextColor(...GRAY)
        doc.text('Conditional Uses:', M, b.getY()); b.setY(b.getY() + 4.5)
        b.bulletList(intel.zoning.conditional_uses)
      }
      if (intel.zoning.notes) b.bodyText(intel.zoning.notes)
    }

    // Building Restrictions
    if (intel.building_restrictions) {
      const br = intel.building_restrictions
      b.heading2('Building Restrictions')
      b.label('Max Height', br.max_height_m != null ? `${br.max_height_m}m${br.max_height_stories ? ` / ${br.max_height_stories} stories` : ''}` : null)
      b.label('Max FAR', br.max_far)
      b.label('Max Lot Coverage', br.lot_coverage_max_pct != null ? `${br.lot_coverage_max_pct}%` : null)
      b.label('Front Setback', br.min_setback_front_m != null ? `${br.min_setback_front_m}m` : null)
      b.label('Side Setback', br.min_setback_side_m != null ? `${br.min_setback_side_m}m` : null)
      b.label('Rear Setback', br.min_setback_rear_m != null ? `${br.min_setback_rear_m}m` : null)
      b.label('Parking Ratio', br.parking_ratio)
      if (br.notes) b.bodyText(br.notes)
    }

    // Building Codes
    if (bc) {
      b.heading2('Building Codes')
      b.label('Primary Code', bc.primary_code)
      b.label('State Code', bc.state_adopted_code)
      b.label('Fire / Life Safety', bc.fire_code)
      b.label('Energy Code', bc.energy_code)
      b.label('Electrical Code', bc.electrical_code)
      b.label('Plumbing Code', bc.plumbing_code)
      b.label('Seismic SDC', bc.seismic_design_category ? `SDC ${bc.seismic_design_category}` : null)
      b.label('Wind Exposure', bc.wind_exposure_category ? `Category ${bc.wind_exposure_category}` : null)
    }

    // Healthcare & FGI
    if (intel.healthcare_constraints) {
      const hc = intel.healthcare_constraints
      b.heading2('Healthcare Planning & FGI Guidelines')
      b.label('FGI Version', hc.fgi_version)
      b.label('State Adopts FGI', hc.state_adopts_fgi)
      b.label('Health Authority', hc.state_health_authority)
      b.label('CON Required', hc.certificate_of_need_required)
      b.label('CON Scope', hc.con_scope)
      if (hc.key_fgi_requirements?.length) {
        b.checkBreak(10)
        doc.setFontSize(8); doc.setTextColor(...GRAY)
        doc.text('Key FGI Requirements:', M, b.getY()); b.setY(b.getY() + 4.5)
        b.bulletList(hc.key_fgi_requirements)
      }
      b.label('Infection Control Zones', hc.infection_control_zones)
      b.label('Emergency Power', hc.emergency_power)
      if (hc.notes) b.bodyText(hc.notes)
    }

    // Environmental & Climate
    b.heading2('Environmental & Climate')
    if (intel.flood_data) {
      b.label('Flood Zone', intel.flood_data.zone ? `Zone ${intel.flood_data.zone} — ${intel.flood_data.risk || ''}` : null)
      if (intel.flood_data.sfha) {
        doc.setFontSize(8); doc.setTextColor(200, 50, 50)
        doc.text('⚠ Special Flood Hazard Area — flood insurance required', M, b.getY())
        b.setY(b.getY() + 5)
      }
      if (intel.flood_data.description) b.bodyText(intel.flood_data.description)
    }
    if (intel.air_quality_data) {
      b.label('Air Quality (AQI)', intel.air_quality_data.us_aqi != null
        ? `${intel.air_quality_data.us_aqi} — ${intel.air_quality_data.aqi_label || ''}` : null)
    }
    const cl = intel.climate_data
    if (cl) {
      b.label('Current Temperature', cl.current_temp_c != null ? `${cl.current_temp_c}°C / ${cl.current_temp_f}°F` : null)
      b.label('Humidity', cl.current_humidity_pct != null ? `${cl.current_humidity_pct}%` : null)
      b.label('Wind', cl.current_wind_kmh != null ? `${cl.current_wind_kmh} km/h ${cl.current_wind_dir || ''}` : null)
      b.label('Weekly High/Low', (cl.weekly_avg_high_c != null && cl.weekly_avg_low_c != null)
        ? `${cl.weekly_avg_high_c}°C / ${cl.weekly_avg_low_c}°C` : null)
      b.label('7-Day Precipitation', cl.weekly_total_precip_mm != null ? `${cl.weekly_total_precip_mm} mm` : null)
    }
    const env = intel.environmental
    if (env) {
      b.label('Solar Orientation', env.solar_orientation)
      b.label('Prevailing Wind', env.prevailing_wind)
      b.label('Noise Sources', env.noise_sources)
      b.label('Sustainability Code', env.sustainability_code)
      b.label('Utility Intensity', env.utility_intensity)
      if (env.stormwater_notes) b.bodyText(env.stormwater_notes)
    }

    // Nearby Infrastructure
    const nb = intel.nearby_infrastructure
    if (nb) {
      b.heading2('Nearby Infrastructure')
      b.label('Hospitals / Clinics', nb.hospital_count != null ? `${nb.hospital_count} within 2 km` : null)
      b.label('Transit Stops', nb.transit_count != null ? `${nb.transit_count} within 1.2 km` : null)
      b.label('Major Roads', nb.road_count != null ? `${nb.road_count} within 700 m` : null)
      if (nb.hospitals?.length) {
        doc.setFontSize(8); doc.setTextColor(...GRAY)
        doc.text('Healthcare Facilities:', M, b.getY()); b.setY(b.getY() + 4.5)
        b.bulletList(nb.hospitals.slice(0, 8).map(h => `${h.name} (${h.type})`))
      }
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(...GRAY)
    doc.text('HealthArch · Project Planning Report · For planning reference only', M, PAGE_H - 8)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - M - 18, PAGE_H - 8)
  }

  const safeName = projectName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
  doc.save(`${safeName}_HealthArch_Report.pdf`)
}
