import type { Song } from '../music/types'
import { audioEngine } from './AudioEngine'

export function seekPlayback(
  beat: number,
  song: Song,
  isPlaying: boolean,
  onBeat: (beat: number) => void,
): void {
  const next = Math.max(0, beat)
  onBeat(next)
  if (isPlaying) audioEngine.seekToBeat(next, song.bpm)
}

/** Stop audio and jump playhead + timelines to beat 0 with no camera easing. */
export function stopAndSnapToStart(dispatch: (action: { type: 'GO_TO_START' }) => void): void {
  audioEngine.stop()
  dispatch({ type: 'GO_TO_START' })
}
