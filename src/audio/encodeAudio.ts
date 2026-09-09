/** Convert float samples to 16-bit PCM. */
export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
}

/** PCM WAV blob from one or two float channels. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const ch = Math.min(2, Math.max(1, channels.length))
  const length = channels[0]?.length ?? 0
  const bytesPerSample = 2
  const blockAlign = ch * bytesPerSample
  const dataSize = length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, ch, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const pcm = channels.map(floatToInt16)
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < ch; c++) {
      view.setInt16(offset, pcm[Math.min(c, pcm.length - 1)][i], true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** MP3 blob via lamejs. */
export async function encodeMp3(
  channels: Float32Array[],
  sampleRate: number,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const ch = channels.length >= 2 ? 2 : 1
  const encoder = new Mp3Encoder(ch, sampleRate, 192)
  const left = floatToInt16(channels[0] ?? new Float32Array())
  const right = ch === 2 ? floatToInt16(channels[1] ?? channels[0]) : undefined
  const block = 1152
  const parts: Uint8Array[] = []
  const total = Math.max(1, left.length)

  for (let i = 0, n = 0; i < left.length; i += block, n++) {
    const l = left.subarray(i, i + block)
    const encoded =
      ch === 2 && right
        ? encoder.encodeBuffer(l, right.subarray(i, i + block))
        : encoder.encodeBuffer(l)
    if (encoded.length > 0) parts.push(encoded)
    if (n % 12 === 0) {
      onProgress?.(i / total)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  const flushed = encoder.flush()
  if (flushed.length > 0) parts.push(flushed)
  const bytes = parts.reduce((n, part) => n + part.byteLength, 0)
  const packed = new Uint8Array(bytes)
  let offset = 0
  for (const part of parts) {
    packed.set(part, offset)
    offset += part.byteLength
  }
  onProgress?.(1)
  return new Blob([packed], { type: 'audio/mpeg' })
}

export function channelsFromAudioBuffer(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = []
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }
  return channels
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
