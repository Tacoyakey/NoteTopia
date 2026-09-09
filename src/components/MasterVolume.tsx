import { useEffect, useRef, useState } from 'react'
import { getMasterVolume, readMasterLevels, setMasterVolume } from '../audio/masterBus'
import { Volume1, Volume2, VolumeX } from './icons'
import { useT } from '../i18n/LanguageProvider'

const FALLBACK_W = 108
const FALLBACK_H = 22

export function MasterVolume() {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLLabelElement>(null)
  const volumeRef = useRef(getMasterVolume())
  const hideTimer = useRef(0)
  const holding = useRef(false)
  const [volume, setVolume] = useState(getMasterVolume)
  const [scrubbing, setScrubbing] = useState(false)

  volumeRef.current = volume
  const percent = Math.round(volume * 100)
  const Icon = volume <= 0.001 ? VolumeX : volume < 0.4 ? Volume1 : Volume2

  const showPct = () => {
    window.clearTimeout(hideTimer.current)
    setScrubbing(true)
  }
  const hidePctSoon = (ms = 700) => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setScrubbing(false), ms)
  }

  useEffect(() => {
    return () => window.clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    if (!scrubbing) return
    const end = () => {
      holding.current = false
      hidePctSoon(420)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [scrubbing])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.04 : 0.04
      const next = Math.min(1, Math.max(0, Math.round((volumeRef.current + delta) * 100) / 100))
      volumeRef.current = next
      setVolume(next)
      setMasterVolume(next)
      showPct()
      hidePctSoon(800)
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let running = true
    let frame = 0
    const loop = () => {
      if (!running) return
      drawMeter(canvas, volumeRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    const ro = new ResizeObserver(() => drawMeter(canvas, volumeRef.current))
    ro.observe(canvas)
    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [])

  return (
    <label
      ref={rootRef}
      className={`master-vol${scrubbing ? ' is-scrubbing' : ''}`}
      aria-label={t('ui.masterVolume')}
    >
      <span className="master-vol-head">
        <span className="master-vol-icon" aria-hidden>
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="master-vol-pct" aria-hidden>
          {percent}%
        </span>
      </span>
      <span className="master-vol-track">
        <canvas ref={canvasRef} className="master-vol-meter" aria-hidden />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label={t('ui.masterVolume')}
          aria-valuetext={`${percent}%`}
          onPointerDown={() => {
            holding.current = true
            showPct()
          }}
          onChange={(e) => {
            const next = parseFloat(e.target.value)
            setVolume(next)
            setMasterVolume(next)
            showPct()
            if (!holding.current) hidePctSoon(800)
          }}
        />
      </span>
    </label>
  )
}

function drawMeter(canvas: HTMLCanvasElement | null, volume: number) {
  if (!canvas) return
  if (!canvas.clientWidth) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const cssW = Math.max(1, canvas.clientWidth || FALLBACK_W)
  const cssH = Math.max(1, canvas.clientHeight || FALLBACK_H)
  const dpr = window.devicePixelRatio || 1
  const nextW = Math.max(1, Math.round(cssW * dpr))
  const nextH = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW
    canvas.height = nextH
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const w = cssW
  const h = cssH
  const levels = readMasterLevels()
  const live = Math.max(levels.l, levels.r)
  const peak = Math.max(levels.peakL, levels.peakR)

  ctx.clearRect(0, 0, w, h)

  const thumbR = 7
  const padX = thumbR
  const barH = 10
  const y = (h - barH) / 2
  const barW = Math.max(1, w - padX * 2)
  const x = padX

  ctx.beginPath()
  ctx.roundRect(x, y, barW, barH, barH / 2)
  ctx.fillStyle = '#141414'
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, barW, barH, barH / 2)
  ctx.clip()

  const volW = Math.max(0, Math.min(barW, volume * barW))
  if (volW > 0.5) {
    ctx.fillStyle = 'rgba(61, 220, 132, 0.28)'
    ctx.fillRect(x, y, volW, barH)
  }

  const liveW = Math.max(0, Math.min(barW, live * barW))
  if (liveW > 1) {
    ctx.fillStyle = live > 0.92 ? '#e53935' : live > 0.84 ? '#f5d142' : '#3ddc84'
    ctx.fillRect(x, y, liveW, barH)
  }

  if (peak > 0.03) {
    const px = x + Math.min(barW - 1.5, peak * barW)
    ctx.fillStyle = peak > 0.92 ? '#ff6b6b' : '#d8ffe8'
    ctx.fillRect(px - 1.5, y, 3, barH)
  }
  ctx.restore()

  const thumbX = Math.max(thumbR, Math.min(w - thumbR, padX + volume * barW))
  ctx.beginPath()
  ctx.arc(thumbX, h / 2, thumbR, 0, Math.PI * 2)
  ctx.fillStyle = '#3ddc84'
  ctx.fill()
}
