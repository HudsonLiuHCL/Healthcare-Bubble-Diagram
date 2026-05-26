/// <reference types="vite/client" />

declare module '@mapbox/mapbox-gl-geocoder' {
  import type { IControl } from 'mapbox-gl'
  interface GeocoderOptions {
    accessToken: string
    mapboxgl?: unknown
    placeholder?: string
    marker?: boolean
    [key: string]: unknown
  }
  class MapboxGeocoder implements IControl {
    constructor(options: GeocoderOptions)
    on(event: string, handler: (e: unknown) => void): this
    onAdd(map: unknown): HTMLElement
    onRemove(): void
  }
  export = MapboxGeocoder
}
