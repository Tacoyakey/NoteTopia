import type { WeatherDef } from './types'

export const DEFAULT_SOLID = '#1c1c28'

export const solidWeather: WeatherDef = {
  id: 'solid',
  label: 'Solid',
  dark: true,
  draw(ctx, width, height, _cameraX, _zoom, opts) {
    ctx.fillStyle = opts?.solidColor || DEFAULT_SOLID
    ctx.fillRect(0, 0, width, height)
  },
}
