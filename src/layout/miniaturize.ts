/** Layout changes used to morph via view transitions; that scaled the trigger into the panel. */
export const MINIATURIZE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const MINIATURIZE_MS = 280

/** Apply a layout change. Enter/exit motion lives in CSS (transform + opacity only). */
export function runMiniaturize(mutate: () => void, _el?: HTMLElement | null): void {
  mutate()
}
