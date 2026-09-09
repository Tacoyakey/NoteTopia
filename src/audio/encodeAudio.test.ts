import { describe, expect, it } from 'vitest'
import { encodeMp3, encodeWav, floatToInt16 } from '../audio/encodeAudio'

function sine(n: number, freq = 440, sr = 44100): Float32Array {
  const data = new Float32Array(n)
  for (let i = 0; i < n; i++) data[i] = Math.sin((2 * Math.PI * freq * i) / sr) * 0.2
  return data
}

describe('audio encode', () => {
  it('converts float samples to 16-bit PCM', () => {
    const pcm = floatToInt16(new Float32Array([0, 0.5, -1, 2]))
    expect(pcm[0]).toBe(0)
    expect(pcm[1]).toBeGreaterThan(0)
    expect(pcm[2]).toBe(-0x8000)
    expect(pcm[3]).toBe(0x7fff)
  })

  it('writes a WAV header and PCM payload', () => {
    const blob = encodeWav([sine(256, 220, 8000)], 8000)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 256 * 2)
  })

  it('encodes MP3 frames', async () => {
    const blob = await encodeMp3([sine(4410)], 44100)
    expect(blob.type).toBe('audio/mpeg')
    expect(blob.size).toBeGreaterThan(32)
  })
})
