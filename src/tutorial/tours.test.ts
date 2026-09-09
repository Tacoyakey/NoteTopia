import { describe, expect, it } from 'vitest'
import { t } from '../i18n/i18n'
import { TOURS, tourById, visibleTourSteps } from './tours'

describe('tours', () => {
  it('keeps three reopenable tours', () => {
    expect(tourById('start')?.steps.length).toBeGreaterThan(3)
    expect(tourById('midi')?.steps.length).toBeGreaterThan(2)
    expect(tourById('sheet')?.steps.length).toBeGreaterThan(2)
    expect(tourById('nope')).toBeNull()
  })

  it('hides Composer mode pills in Simple', () => {
    const start = tourById('start')!
    expect(visibleTourSteps(start, false).some((step) => step.target === 'mode-pills')).toBe(true)
    expect(visibleTourSteps(start, true).some((step) => step.target === 'mode-pills')).toBe(false)
  })

  it('opens the World panel for layer steps', () => {
    const start = tourById('start')!
    expect(start.steps.find((step) => step.target === 'place-as')?.reveal).toBe('world-panel')
    expect(tourById('midi')?.steps.find((step) => step.target === 'midi-layers')?.reveal).toBe('world-panel')
  })

  it('opens the export menu on the GMSF step', () => {
    const sheet = tourById('sheet')!
    const last = sheet.steps[sheet.steps.length - 1]
    expect(last.target).toBe('export-gmsf')
    expect(last.reveal).toBe('export-menu')
  })

  it('resolves every tour string in English', () => {
    for (const tour of TOURS) {
      expect(t(tour.titleKey)).not.toBe(tour.titleKey)
      expect(t(tour.leadKey)).not.toBe(tour.leadKey)
      for (const step of tour.steps) {
        expect(t(step.titleKey)).not.toBe(step.titleKey)
        expect(t(step.bodyKey)).not.toBe(step.bodyKey)
      }
    }
  })
})
