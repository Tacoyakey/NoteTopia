import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Public GitHub Pages must not ship Ubisoft audio or sheet sprites. */
function omitThirdPartyGameAssets() {
  return {
    name: 'omit-third-party-game-assets',
    apply: 'build' as const,
    closeBundle() {
      if (process.env.GITHUB_PAGES !== 'true') return
      const dist = join(process.cwd(), 'dist')
      stripMatching(join(dist, 'notes'), /\.(wav|ogg|mp3)$/i)
      stripMatching(join(dist, 'tiles'), /\.png$/i)
    },
  }
}

function stripMatching(dir: string, pattern: RegExp): void {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    if (!pattern.test(name)) continue
    rmSync(join(dir, name), { force: true })
  }
}

export default defineConfig({
  plugins: [react(), omitThirdPartyGameAssets()],
  base: process.env.GITHUB_PAGES === 'true' ? '/NoteTopia/' : '/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
