import type { WorldWeather } from '../../music/types'

export type { WorldWeather }

export interface WeatherDrawOpts {
  solidColor?: string
}

export interface WeatherDef {
  id: WorldWeather
  label: string
  /** Dark UI overlays (labels, grid) vs light-sky overlays */
  dark: boolean
  /** When true the world canvas keeps a render loop even while idle. */
  animated?: boolean
  draw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cameraX: number,
    zoom: number,
    opts?: WeatherDrawOpts,
  ) => void
  /** Drawn after world tiles, so it can sit on top of the scene. */
  overlay?: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cameraX: number,
    zoom: number,
  ) => void
}
