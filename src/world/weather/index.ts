import type { WorldWeather } from '../../music/types'
import type { WeatherDef, WeatherDrawOpts } from './types'
import { galacticWeather } from './galactic'
import { sunnyWeather } from './sunny'
import { snowyWeather } from './snowy'
import { snowyNightWeather } from './snowyNight'
import { voidWeather } from './void'
import { solidWeather } from './solid'
import { petalHavenWeather } from './petalHaven'
import { nightWeather } from './night'
import { beachWeather } from './beach'
import { probeWeather, weatherAssets } from './assets'

export type { WeatherDef, WeatherDrawOpts } from './types'
export { probeWeather, subscribeWeather } from './assets'
export { DEFAULT_SOLID } from './solid'

/** Register a weather here to show it in the World picker. */
export const WEATHERS: WeatherDef[] = [
  sunnyWeather,
  nightWeather,
  beachWeather,
  snowyWeather,
  snowyNightWeather,
  galacticWeather,
  petalHavenWeather,
  voidWeather,
  solidWeather,
]

const byId = new Map(WEATHERS.map((w) => [w.id, w]))

export function getWeather(id: string | undefined | null): WeatherDef {
  const key = id === 'warp' ? 'galactic' : id
  return byId.get((key as WorldWeather) ?? 'sunny') ?? sunnyWeather
}

export function drawWeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraX: number,
  zoom: number,
  id: string | undefined,
  opts?: WeatherDrawOpts,
): WeatherDef {
  if (
    (weatherAssets.stars.length === 0 && !weatherAssets.warp) ||
    (id === 'petal-haven' && !weatherAssets.pphBg) ||
    (id === 'night' && !weatherAssets.nightBack) ||
    (id === 'beach' && !weatherAssets.sunset)
  ) {
    void probeWeather()
  }
  const weather = getWeather(id)
  weather.draw(ctx, width, height, cameraX, zoom, opts)
  return weather
}
