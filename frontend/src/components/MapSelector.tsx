import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || ''

interface DrawEvent {
  features: GeoJSON.Feature[]
}

interface Props {
  onSiteConfirmed: (data: {
    address: string
    lat: number
    lng: number
    parcel_geojson: object | null
    lot_area_sqm: number
  }) => void
  isConfirming: boolean
}

function computeAreaSqm(geojson: GeoJSON.Polygon | null): number {
  if (!geojson || !geojson.coordinates?.length) return 0
  const coords = geojson.coordinates[0]
  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i]
    const [x2, y2] = coords[i + 1]
    area += x1 * y2 - x2 * y1
  }
  const areaDegs = Math.abs(area / 2)
  // rough conversion: 1 degree ≈ 111,320m at equator
  return areaDegs * 111320 * 111320
}

export default function MapSelector({ onSiteConfirmed, isConfirming }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const [address, setAddress] = useState('')
  const [center, setCenter] = useState<[number, number]>([-87.6298, 41.8781]) // Chicago default
  const [drawnFeature, setDrawnFeature] = useState<GeoJSON.Feature | null>(null)
  const [lotArea, setLotArea] = useState(0)
  const [mapStyle, setMapStyle] = useState<'satellite' | 'streets'>('streets')
  const [satelliteOn, setSatelliteOn] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 13,
    })

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'draw_polygon',
      styles: [
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon']],
          paint: { 'fill-color': '#4f6ef7', 'fill-opacity': 0.25 },
        },
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon']],
          paint: { 'line-color': '#4f6ef7', 'line-width': 2 },
        },
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: { 'circle-radius': 4, 'circle-color': '#4f6ef7' },
        },
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
          paint: { 'circle-radius': 6, 'circle-color': '#4f6ef7', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        },
      ],
    })

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl as unknown as typeof import('mapbox-gl'),
      placeholder: 'Search address or coordinates…',
      marker: false,
    })

    geocoder.on('result', (e: unknown) => {
      const ev = e as { result: { place_name: string; center: [number, number] } }
      setAddress(ev.result.place_name)
      setCenter(ev.result.center)
    })

    map.addControl(geocoder, 'top-left')
    map.addControl(draw, 'top-right')
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    const handleDraw = () => {
      const data = draw.getAll()
      if (data.features.length > 0) {
        const feature = data.features[0]
        setDrawnFeature(feature)
        const geom = feature.geometry as GeoJSON.Polygon
        setLotArea(Math.round(computeAreaSqm(geom)))
      } else {
        setDrawnFeature(null)
        setLotArea(0)
      }
    }

    map.on('draw.create', handleDraw)
    map.on('draw.update', handleDraw)
    map.on('draw.delete', handleDraw)

    mapRef.current = map
    drawRef.current = draw

    return () => { map.remove(); mapRef.current = null }
  }, [])

  const toggleStyle = () => {
    const map = mapRef.current
    if (!map) return
    if (!satelliteOn) {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v12')
      setSatelliteOn(true)
    } else {
      map.setStyle('mapbox://styles/mapbox/dark-v11')
      setSatelliteOn(false)
    }
  }

  const handleConfirm = () => {
    const [lng, lat] = center
    const parcel = drawnFeature?.geometry ?? null
    onSiteConfirmed({
      address,
      lat,
      lng,
      parcel_geojson: parcel as object | null,
      lot_area_sqm: lotArea,
    })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Right panel */}
      <div className="absolute top-4 right-16 bottom-4 w-72 flex flex-col gap-3 pointer-events-none">
        {/* Layer toggles */}
        <div className="bg-panel/90 backdrop-blur border border-border rounded-xl p-4 pointer-events-auto">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Map Layers</p>
          <button
            onClick={toggleStyle}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm transition-colors ${satelliteOn ? 'bg-accent/20 text-accent' : 'text-muted hover:text-white hover:bg-border'}`}
          >
            <span>Satellite View</span>
            <div className={`w-8 h-4 rounded-full transition-colors ${satelliteOn ? 'bg-accent' : 'bg-border'}`}>
              <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${satelliteOn ? 'translate-x-4.5 ml-1' : 'ml-0.5'}`} />
            </div>
          </button>
        </div>

        {/* Parcel info */}
        {drawnFeature && (
          <div className="bg-panel/90 backdrop-blur border border-accent/30 rounded-xl p-4 pointer-events-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Parcel</p>
            <div className="text-2xl font-bold text-white">
              {lotArea.toLocaleString()} <span className="text-sm font-normal text-muted">m²</span>
            </div>
            <div className="text-xs text-muted mt-1">
              ≈ {(lotArea / 0.0929).toLocaleString(undefined, { maximumFractionDigits: 0 })} ft²
            </div>
            {address && (
              <div className="mt-3 text-xs text-muted border-t border-border pt-3 leading-relaxed">
                {address}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!drawnFeature && (
          <div className="bg-panel/90 backdrop-blur border border-border rounded-xl p-4 pointer-events-auto">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Instructions</p>
            <ol className="text-xs text-muted space-y-1.5">
              <li className="flex gap-2"><span className="text-accent font-medium">1.</span> Search for an address above</li>
              <li className="flex gap-2"><span className="text-accent font-medium">2.</span> Use the polygon tool (top-right) to draw the parcel boundary</li>
              <li className="flex gap-2"><span className="text-accent font-medium">3.</span> Click vertices to draw, double-click to close</li>
              <li className="flex gap-2"><span className="text-accent font-medium">4.</span> Confirm the site below</li>
            </ol>
          </div>
        )}

        {/* Confirm button */}
        <div className="mt-auto pointer-events-auto">
          <button
            onClick={handleConfirm}
            disabled={isConfirming || (!address && !drawnFeature)}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white py-3 rounded-xl font-medium text-sm transition-colors shadow-lg"
          >
            {isConfirming ? 'Confirming Site…' : 'Confirm Site →'}
          </button>
          {!address && !drawnFeature && (
            <p className="text-center text-xs text-muted mt-2">Search or draw a parcel to continue</p>
          )}
        </div>
      </div>
    </div>
  )
}
