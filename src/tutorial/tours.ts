export type TourId = 'start' | 'midi' | 'sheet' | 'phone'

export type TourStep = {
  titleKey: string
  bodyKey: string
  target?: string
  mode?: 'world' | 'composer'
  skipSimple?: boolean
  reveal?: 'world-panel' | 'export-menu'
}

export type TourDef = {
  id: TourId
  titleKey: string
  leadKey: string
  steps: TourStep[]
}

export const TOURS: TourDef[] = [
  {
    id: 'start',
    titleKey: 'tour.start.title',
    leadKey: 'tour.start.lead',
    steps: [
      { titleKey: 'tour.start.s1.title', bodyKey: 'tour.start.s1.body' },
      { titleKey: 'tour.start.s2.title', bodyKey: 'tour.start.s2.body', target: 'mode-pills', skipSimple: true },
      { titleKey: 'tour.start.s3.title', bodyKey: 'tour.start.s3.body', target: 'world-sheet', mode: 'world' },
      { titleKey: 'tour.start.s4.title', bodyKey: 'tour.start.s4.body', target: 'world-tools', mode: 'world' },
      { titleKey: 'tour.start.s5.title', bodyKey: 'tour.start.s5.body', target: 'place-as', mode: 'world', reveal: 'world-panel' },
      { titleKey: 'tour.start.s6.title', bodyKey: 'tour.start.s6.body', target: 'play' },
      { titleKey: 'tour.start.s7.title', bodyKey: 'tour.start.s7.body', target: 'save' },
    ],
  },
  {
    id: 'midi',
    titleKey: 'tour.midi.title',
    leadKey: 'tour.midi.lead',
    steps: [
      { titleKey: 'tour.midi.s1.title', bodyKey: 'tour.midi.s1.body', target: 'open' },
      { titleKey: 'tour.midi.s2.title', bodyKey: 'tour.midi.s2.body', target: 'open' },
      { titleKey: 'tour.midi.s3.title', bodyKey: 'tour.midi.s3.body', target: 'midi-layers', mode: 'world', reveal: 'world-panel' },
      { titleKey: 'tour.midi.s4.title', bodyKey: 'tour.midi.s4.body', target: 'place-as', mode: 'world', reveal: 'world-panel' },
    ],
  },
  {
    id: 'sheet',
    titleKey: 'tour.sheet.title',
    leadKey: 'tour.sheet.lead',
    steps: [
      { titleKey: 'tour.sheet.s1.title', bodyKey: 'tour.sheet.s1.body', target: 'world-sheet', mode: 'world' },
      { titleKey: 'tour.sheet.s2.title', bodyKey: 'tour.sheet.s2.body', target: 'world-tools', mode: 'world' },
      { titleKey: 'tour.sheet.s3.title', bodyKey: 'tour.sheet.s3.body', target: 'place-as', mode: 'world', reveal: 'world-panel' },
      { titleKey: 'tour.sheet.s4.title', bodyKey: 'tour.sheet.s4.body', target: 'export-gmsf', reveal: 'export-menu' },
    ],
  },
  {
    id: 'phone',
    titleKey: 'tour.phone.title',
    leadKey: 'tour.phone.lead',
    steps: [
      { titleKey: 'tour.phone.s1.title', bodyKey: 'tour.phone.s1.body', mode: 'world' },
      { titleKey: 'tour.phone.s2.title', bodyKey: 'tour.phone.s2.body', target: 'phone-dock', mode: 'world' },
      { titleKey: 'tour.phone.s3.title', bodyKey: 'tour.phone.s3.body', target: 'world-tools', mode: 'world' },
      { titleKey: 'tour.phone.s4.title', bodyKey: 'tour.phone.s4.body', target: 'play' },
      { titleKey: 'tour.phone.s5.title', bodyKey: 'tour.phone.s5.body', target: 'mode-pills', skipSimple: true },
      { titleKey: 'tour.phone.s6.title', bodyKey: 'tour.phone.s6.body', target: 'save' },
    ],
  },
]

export function tourById(id: string | null | undefined): TourDef | null {
  return TOURS.find((tour) => tour.id === id) ?? null
}

export function visibleTourSteps(tour: TourDef, simple: boolean): TourStep[] {
  return tour.steps.filter((step) => !(simple && step.skipSimple))
}
