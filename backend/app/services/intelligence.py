import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date
from openai import OpenAI
import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..models.models import SiteIntelligence, IntelligenceStatus

# ─── API helpers ─────────────────────────────────────────────────────────────

_HEADERS = {"User-Agent": "HealthArch/1.0 (healtharch-mvp; contact@healtharch.io)"}


def _get(url, params=None, timeout=10):
    try:
        r = httpx.get(url, params=params, headers=_HEADERS, timeout=timeout, follow_redirects=True)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"_error": str(e)[:120]}


def _post(url, data, timeout=15):
    try:
        r = httpx.post(url, data=data, headers=_HEADERS, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"_error": str(e)[:120]}


# ─── Individual fetchers ──────────────────────────────────────────────────────

def fetch_address_details(lat, lng):
    data = _get("https://nominatim.openstreetmap.org/reverse", {
        "format": "json", "lat": lat, "lon": lng, "zoom": 14, "addressdetails": 1,
    })
    if "_error" in data:
        return {}
    addr = data.get("address", {})
    iso = addr.get("ISO3166-2-lvl4", "")
    return {
        "display_name": data.get("display_name"),
        "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("suburb"),
        "county": addr.get("county"),
        "state": addr.get("state"),
        "state_abbr": iso.replace("US-", "").replace("CA-", ""),
        "country": addr.get("country"),
        "country_code": addr.get("country_code", "").upper(),
        "postcode": addr.get("postcode"),
        "osm_type": data.get("type"),
    }


def fetch_elevation(lat, lng):
    data = _get(f"https://api.opentopodata.org/v1/srtm30m?locations={lat},{lng}")
    if "_error" in data or data.get("status") != "OK":
        return {}
    results = data.get("results", [])
    if results:
        elev = results[0].get("elevation")
        if elev is not None:
            return {
                "elevation_m": round(elev, 1),
                "elevation_ft": round(elev * 3.28084, 0),
            }
    return {}


def fetch_sun_data(lat, lng):
    year = date.today().year

    def _sun(d):
        r = _get("https://api.sunrisesunset.io/json", {"lat": lat, "lng": lng, "timezone": "UTC", "date": d})
        if "_error" in r or r.get("status") != "OK":
            return {}
        res = r.get("results", {})
        return {
            "sunrise": res.get("sunrise"),
            "sunset": res.get("sunset"),
            "day_length": res.get("day_length"),
            "solar_noon": res.get("solar_noon"),
            "dawn": res.get("dawn"),
            "dusk": res.get("dusk"),
        }

    return {
        "today": _sun(date.today().isoformat()),
        "summer_solstice": _sun(f"{year}-06-21"),
        "winter_solstice": _sun(f"{year}-12-21"),
        "spring_equinox": _sun(f"{year}-03-21"),
        "latitude": lat,
        "longitude": lng,
    }


def fetch_climate(lat, lng):
    data = _get("https://api.open-meteo.com/v1/forecast", {
        "latitude": lat, "longitude": lng,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant",
        "timezone": "auto",
        "forecast_days": 7,
    })
    if "_error" in data:
        return {}

    cur = data.get("current", {})
    daily = data.get("daily", {})

    def _avg(lst):
        vals = [v for v in (lst or []) if v is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    def _c_to_f(c):
        return round(c * 9 / 5 + 32, 1) if c is not None else None

    wind_deg = cur.get("wind_direction_10m")
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    wind_cardinal = dirs[round(wind_deg / 22.5) % 16] if wind_deg is not None else None

    return {
        "timezone": data.get("timezone"),
        "current_temp_c": cur.get("temperature_2m"),
        "current_temp_f": _c_to_f(cur.get("temperature_2m")),
        "current_humidity_pct": cur.get("relative_humidity_2m"),
        "current_wind_kmh": cur.get("wind_speed_10m"),
        "current_wind_dir_deg": wind_deg,
        "current_wind_dir": wind_cardinal,
        "weekly_avg_high_c": _avg(daily.get("temperature_2m_max")),
        "weekly_avg_low_c": _avg(daily.get("temperature_2m_min")),
        "weekly_avg_high_f": _c_to_f(_avg(daily.get("temperature_2m_max"))),
        "weekly_avg_low_f": _c_to_f(_avg(daily.get("temperature_2m_min"))),
        "weekly_total_precip_mm": round(sum(v for v in (daily.get("precipitation_sum") or []) if v), 1),
        "weekly_max_wind_kmh": _avg(daily.get("windspeed_10m_max")),
    }


def fetch_air_quality(lat, lng):
    data = _get("https://air-quality-api.open-meteo.com/v1/air-quality", {
        "latitude": lat, "longitude": lng,
        "current": "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone",
        "timezone": "auto",
    })
    if "_error" in data:
        return {}
    cur = data.get("current", {})
    aqi = cur.get("us_aqi")
    label = (
        "Good" if aqi is not None and aqi <= 50 else
        "Moderate" if aqi is not None and aqi <= 100 else
        "Unhealthy for Sensitive Groups" if aqi is not None and aqi <= 150 else
        "Unhealthy" if aqi is not None and aqi <= 200 else
        "Very Unhealthy" if aqi is not None and aqi <= 300 else
        "Hazardous" if aqi is not None else "Unknown"
    )
    return {
        "us_aqi": aqi,
        "aqi_label": label,
        "pm2_5_ugm3": cur.get("pm2_5"),
        "pm10_ugm3": cur.get("pm10"),
        "no2_ugm3": cur.get("nitrogen_dioxide"),
        "o3_ugm3": cur.get("ozone"),
    }


def fetch_flood_zone(lat, lng):
    data = _get(
        "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query",
        {
            "geometry": f"{lng},{lat}",
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STUDY_TYP",
            "returnGeometry": "false",
            "f": "json",
            "inSR": "4326",
        },
        timeout=12,
    )
    if "_error" in data:
        return {"zone": "Unknown", "risk": "Unknown", "note": "FEMA data unavailable"}
    features = data.get("features", [])
    if not features:
        return {"zone": "X", "risk": "Low / Minimal", "note": "Outside mapped flood area"}
    attrs = features[0].get("attributes", {})
    zone = attrs.get("FLD_ZONE", "X")
    subty = attrs.get("ZONE_SUBTY", "")
    sfha = attrs.get("SFHA_TF") == "T"
    high = zone and (zone.startswith("A") or zone.startswith("V"))
    mod = not high and subty and "0.2 PCT" in subty
    risk = "High (SFHA)" if high else "Moderate (0.2% Annual)" if mod else "Low / Minimal"
    zone_descriptions = {
        "AE": "1% annual chance flood with BFE determined",
        "A": "1% annual chance flood (no BFE)",
        "AO": "1% annual chance sheet flow flooding",
        "AH": "1% annual chance ponding",
        "VE": "Coastal high hazard area with BFE",
        "X": "Outside 0.2% annual chance floodplain",
        "B": "Between 1% and 0.2% annual chance",
    }
    return {
        "zone": zone,
        "subtype": subty or None,
        "sfha": sfha,
        "risk": risk,
        "description": zone_descriptions.get(zone, f"Flood Zone {zone}"),
        "study_type": attrs.get("STUDY_TYP"),
    }


def fetch_nearby_infrastructure(lat, lng):
    query = f"""
[out:json][timeout:20];
(
  node["amenity"~"hospital|clinic|doctors|pharmacy"](around:2000,{lat},{lng});
  way["amenity"~"hospital|clinic"](around:2000,{lat},{lng});
  node["public_transport"~"station|stop_position"](around:1200,{lat},{lng});
  node["highway"="bus_stop"](around:1200,{lat},{lng});
  node["railway"~"station|halt|tram_stop|subway_entrance"](around:1500,{lat},{lng});
  way["highway"~"motorway|trunk|primary"](around:700,{lat},{lng});
  node["emergency"="fire_station"](around:2000,{lat},{lng});
  node["amenity"="fire_station"](around:2000,{lat},{lng});
);
out body;
"""
    data = _post("https://overpass-api.de/api/interpreter", {"data": query})
    if "_error" in data:
        return {"hospital_count": 0, "transit_count": 0, "road_count": 0, "error": data["_error"]}

    hospitals, transit, roads, emergency = [], [], [], []
    seen_roads = set()

    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("ref") or "Unnamed"
        amenity = tags.get("amenity", "")
        highway = tags.get("highway", "")
        railway = tags.get("railway", "")
        pt = tags.get("public_transport", "")

        if amenity in ("hospital", "clinic", "doctors"):
            hospitals.append({"name": name, "type": amenity, "beds": tags.get("beds")})
        elif amenity == "pharmacy":
            hospitals.append({"name": name, "type": "pharmacy"})
        elif amenity in ("fire_station",) or tags.get("emergency") == "fire_station":
            emergency.append({"name": name, "type": "fire_station"})
        elif highway == "bus_stop" or pt in ("station", "stop_position") or railway in ("station", "halt", "tram_stop", "subway_entrance"):
            ttype = railway or pt or "bus_stop"
            transit.append({"name": name, "type": ttype})
        elif highway in ("motorway", "trunk", "primary"):
            if name not in seen_roads:
                roads.append({"name": name, "type": highway})
                seen_roads.add(name)

    return {
        "hospitals": hospitals[:12],
        "hospital_count": len(hospitals),
        "transit": transit[:12],
        "transit_count": len(transit),
        "major_roads": roads[:6],
        "road_count": len(roads),
        "emergency": emergency[:5],
    }


# ─── AI synthesis ─────────────────────────────────────────────────────────────

def synthesize_with_ai(address, lat, lng, lot_area, site_data):
    client = OpenAI(api_key=settings.openai_api_key)
    addr = site_data.get("address_details", {})
    state = addr.get("state", "Unknown")
    state_abbr = addr.get("state_abbr", "")
    country_code = addr.get("country_code", "US")
    elev = site_data.get("elevation", {}).get("elevation_m")
    climate = site_data.get("climate", {})
    nearby = site_data.get("nearby", {})
    flood = site_data.get("flood", {})
    aq = site_data.get("air_quality", {})

    prompt = f"""You are a licensed architect and healthcare facility planning expert with deep knowledge of:
- US building codes (IBC, state amendments)
- Zoning law for healthcare/medical uses
- FGI Guidelines for Design and Construction of Hospitals and Outpatient Facilities
- ASHRAE climate zones and energy codes
- Certificate of Need (CON) regulations by state

Site Information:
- Address: {address or f"Lat {lat}, Lng {lng}"}
- State: {state} ({state_abbr}), {country_code}
- Coordinates: {lat:.5f}, {lng:.5f}
- Lot Area: {f"{lot_area:.0f} sqm" if lot_area else "Unknown"}
- Elevation: {f"{elev}m" if elev else "Unknown"}
- Current conditions: {climate.get("current_temp_c", "?")}°C, wind {climate.get("current_wind_kmh", "?")} km/h from {climate.get("current_wind_dir", "?")}
- Flood zone: {flood.get("zone", "Unknown")} ({flood.get("risk", "Unknown")})
- Air quality: {aq.get("aqi_label", "Unknown")} (AQI {aq.get("us_aqi", "?")})
- Hospitals within 2km: {nearby.get("hospital_count", 0)}
- Transit stops within 1.2km: {nearby.get("transit_count", 0)}

Return ONLY valid JSON matching this exact structure:
{{
  "zoning": {{
    "likely_zone": "most probable zoning classification (be specific, e.g. C-2, B3-3, HC-1)",
    "permitted_uses": ["healthcare facility", "medical office", "other likely uses"],
    "conditional_uses": ["uses requiring special permit"],
    "min_lot_sqm": null,
    "density_notes": "density/intensity notes",
    "notes": "key zoning notes for this city/jurisdiction"
  }},
  "building_restrictions": {{
    "max_height_m": null,
    "max_height_stories": null,
    "max_far": null,
    "min_setback_front_m": null,
    "min_setback_side_m": null,
    "min_setback_rear_m": null,
    "lot_coverage_max_pct": null,
    "parking_ratio": "e.g. 1 space per 3 beds + 1 per 200sqm GFA",
    "loading_dock_required": true,
    "notes": "additional restriction notes"
  }},
  "building_codes": {{
    "primary_code": "e.g. IBC 2021",
    "state_adopted_code": "state-specific version if different",
    "fire_code": "e.g. NFPA 101 2021 Life Safety Code",
    "energy_code": "e.g. ASHRAE 90.1-2019 / IECC 2021",
    "ashrae_climate_zone": "e.g. 5A",
    "ashrae_climate_description": "e.g. Cold Humid — heating-dominated",
    "seismic_design_category": "A/B/C/D/E/F",
    "wind_exposure_category": "B/C/D",
    "snow_load_applicable": true,
    "accessibility_code": "ADA + state equivalent",
    "plumbing_code": "e.g. IPC 2021",
    "mechanical_code": "e.g. IMC 2021",
    "electrical_code": "e.g. NFPA 70 (NEC) 2023"
  }},
  "healthcare_planning": {{
    "fgi_version": "e.g. FGI 2022",
    "state_adopts_fgi": true,
    "state_health_authority": "name of state health department",
    "certificate_of_need_required": true,
    "con_scope": "brief note on CON thresholds/scope for this state",
    "key_fgi_requirements": [
      "Single-patient rooms required for all new acute care hospitals (FGI 2022 §2.1-3.2)",
      "Minimum patient room area: 14.9 sqm (160 sf) clear floor area",
      "ICU: minimum 18.6 sqm (200 sf) per bed",
      "Emergency Department: minimum 11.1 sqm (120 sf) per treatment space",
      "Ventilation: HVAC per ASHRAE 170-2021 — 6 ACH minimum in patient rooms",
      "Add 5-8 more specific requirements relevant to this state and project type"
    ],
    "infection_control_zones": "Public / Patient Care / Clean / Soiled / Staff",
    "emergency_power": "NFPA 110 Type 10, Class X — generator within 10 seconds",
    "notes": "any state-specific healthcare design requirements"
  }},
  "environmental_planning": {{
    "solar_orientation": "recommended primary facade orientation based on lat {lat:.1f}",
    "prevailing_wind": "estimated prevailing wind direction based on location",
    "noise_sources": "assessment based on nearby roads and infrastructure",
    "sustainability_code": "any mandatory green building code (e.g. CALGreen, Chicago Green Homes)",
    "utility_intensity": "Very High — healthcare requires redundant power, medical gas, HVAC",
    "stormwater_notes": "stormwater management notes based on flood zone and precipitation"
  }},
  "planning_summary": "Write 3-4 sentences summarizing the key planning considerations for a new healthcare facility at this specific site, mentioning the most important zoning, code, environmental, and access factors an architect should know immediately."
}}"""

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.15,
    )
    return json.loads(response.choices[0].message.content)


# ─── Main background task ─────────────────────────────────────────────────────

def run_intelligence_analysis(project_id, address, lat, lng, lot_area, db_factory):
    db: Session = db_factory()
    try:
        intel = db.query(SiteIntelligence).filter(SiteIntelligence.project_id == project_id).first()
        if not intel:
            return

        intel.status = IntelligenceStatus.processing
        intel.updated_at = datetime.utcnow()
        db.commit()

        # 1. Gather real data from 7 APIs in parallel
        fetchers = {
            "address_details": lambda: fetch_address_details(lat, lng),
            "elevation": lambda: fetch_elevation(lat, lng),
            "sun": lambda: fetch_sun_data(lat, lng),
            "climate": lambda: fetch_climate(lat, lng),
            "air_quality": lambda: fetch_air_quality(lat, lng),
            "flood": lambda: fetch_flood_zone(lat, lng),
            "nearby": lambda: fetch_nearby_infrastructure(lat, lng),
        }
        site_data = {}
        with ThreadPoolExecutor(max_workers=7) as executor:
            futures = {executor.submit(fn): key for key, fn in fetchers.items()}
            for future in as_completed(futures):
                key = futures[future]
                try:
                    site_data[key] = future.result()
                except Exception as e:
                    site_data[key] = {"error": str(e)[:100]}

        # 2. AI synthesis with all gathered context
        ai = synthesize_with_ai(address, lat, lng, lot_area, site_data)

        # 3. Persist everything
        intel.address_details = site_data.get("address_details")
        intel.elevation_data = site_data.get("elevation")
        intel.sun_data = site_data.get("sun")
        intel.climate_data = site_data.get("climate")
        intel.air_quality_data = site_data.get("air_quality")
        intel.flood_data = site_data.get("flood")
        intel.nearby_infrastructure = site_data.get("nearby")

        intel.zoning = ai.get("zoning")
        intel.building_restrictions = ai.get("building_restrictions")
        intel.building_codes = ai.get("building_codes")
        intel.environmental = ai.get("environmental_planning")
        intel.healthcare_constraints = ai.get("healthcare_planning")
        intel.planning_summary = ai.get("planning_summary")

        intel.status = IntelligenceStatus.completed
        intel.updated_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        try:
            db.query(SiteIntelligence).filter(
                SiteIntelligence.project_id == project_id
            ).update({
                "status": IntelligenceStatus.failed,
                "raw_analysis": str(e)[:500],
                "updated_at": datetime.utcnow(),
            })
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def trigger_intelligence(project_id, address, lat, lng, lot_area, db_factory):
    t = threading.Thread(
        target=run_intelligence_analysis,
        args=(project_id, address, lat, lng, lot_area, db_factory),
        daemon=True,
    )
    t.start()
