import { useSyncExternalStore } from 'react'

let open = true
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function isPhoneFloatOpen(): boolean {
  return open
}

export function showPhoneFloat(): void {
  if (open) return
  open = true
  emit()
}

export function togglePhoneFloat(): void {
  open = !open
  emit()
}

export function subscribePhoneFloat(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePhoneFloatOpen(): boolean {
  return useSyncExternalStore(subscribePhoneFloat, isPhoneFloatOpen, () => true)
}
