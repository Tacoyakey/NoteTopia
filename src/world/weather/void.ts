import type { WeatherDef } from './types'

export const voidWeather: WeatherDef = {
  id: 'void',
  label: 'Nothingness',
  dark: true,
  draw(ctx, width, height) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
  },
}
