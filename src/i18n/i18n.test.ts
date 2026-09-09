import { describe, expect, it } from 'vitest'
import { applyLocale, convertText, listLocales, t, tAll } from './i18n'
import { localeFlagIso } from './localeFlags'

describe('i18n', () => {
  it('returns English strings and fills placeholders', () => {
    expect(t('help.shortcutsTitle')).toBe('Keyboard shortcuts')
    expect(t('world.statusSelect', { bpm: 104 })).toBe('104 BPM · select · drag to look · tap to pick')
    expect(t('ui.selectedCount', { count: 3 })).toBe('3 selected')
    expect(t('exportMix.longMp3')).toContain('MP3')
    expect(t('exportMix.detail', { format: 'WAV', time: '1:20', notes: 12 })).toContain('WAV')
  })

  it('reads convert copy by model id', () => {
    expect(convertText('v1.5-beta', 'label')).toBe('Preserve')
    expect(convertText('v1', 'label')).toBe('Basic')
    expect(convertText('v1', 'description')).toContain('overlap')
    expect(convertText('v3-experimental', 'label')).toBe('Adapt')
    expect(convertText('v3-experimental', 'hint')).toContain('Audio Rack')
    expect(t('convert.preset.balanced')).toBe('Balanced')
    expect(t('convert.section.arrangement')).toBe('Pitch')
  })

  it('has About copy that disclaims Ubisoft affiliation', () => {
    expect(t('about.unofficial')).toMatch(/unofficial/i)
    expect(t('about.unofficial')).toContain('Ubisoft')
    expect(t('about.unofficial')).toMatch(/permission/i)
    expect(t('ui.about')).toBe('About')
  })

  it('has What’s new copy', () => {
    expect(t('announce.title')).toBe('Welcome')
    expect(t('announce.dontShow')).toContain('Don’t show')
    expect(tAll('announce.post.welcome.items').length).toBeGreaterThan(8)
    expect(tAll('announce.post.welcome.wip').length).toBeGreaterThan(2)
    expect(t('announce.contact')).toContain('Discord')
    expect(t('about.creditDiscord')).toContain('thisistaku')
    expect(t('about.creditSprites')).not.toMatch(/local/i)
  })

  it('has overlay copy for notes from other instruments', () => {
    expect(t('ui.ghostNotes')).toBe('Other tracks')
    expect(t('ui.ghostNotesOn')).toContain('other instruments')
    expect(t('ui.ghostNotesOff')).toContain('Hide')
  })

  it('has MIDI layer copy', () => {
    expect(t('midiLayer.title')).toBe('MIDI layers')
    expect(t('ui.addMidiLayers')).toContain('MIDI')
  })

  it('has NoteTopia file save copy', () => {
    expect(t('ui.saveAs')).toContain('NoteTopia')
    expect(t('ui.exportNotetopia')).toContain('.notetopia')
    expect(t('toast.projectOpened')).toContain('NoteTopia')
  })

  it('has GMSF export copy for kixnoway', () => {
    expect(t('ui.exportGmsf')).toContain('GMSF')
    expect(t('ui.exportGtmusic')).toContain('.gtmusic')
    expect(t('about.creditKixnoway')).toContain('GMSF')
  })

  it('has loading and Growtopia import copy', () => {
    expect(t('ui.loading')).toContain('Loading')
    expect(t('toast.gtImported')).toContain('Growtopia')
  })

  it('has Simple and Studio intro copy', () => {
    expect(t('intro.simpleName')).toBe('Simple')
    expect(t('intro.studioName')).toBe('Studio')
    expect(t('intro.addLayer')).toBe('+ Layer')
  })

  it('has spotlight tutorial copy', () => {
    expect(t('tour.title')).toBe('Tutorials')
    expect(t('tour.start.title')).toBe('Getting started')
    expect(t('tour.midi.title')).toContain('MIDI')
    expect(t('tour.sheet.title')).toContain('Growtopia')
    expect(t('tour.step', { n: 2, total: 7 })).toBe('2 / 7')
    expect(t('tour.start.s1.body')).toContain('Help')
    expect(t('tour.midi.s3.body')).toContain('MIDI')
    expect(t('tour.sheet.s4.body')).toContain('GMSF')
  })

  it('lists twenty launch locales', () => {
    const codes = listLocales().map((item) => item.code)
    expect(codes).toHaveLength(20)
    expect(codes).toEqual(
      expect.arrayContaining([
        'en',
        'ja',
        'zh',
        'es',
        'fr',
        'de',
        'pt',
        'ko',
        'it',
        'ru',
        'nl',
        'pl',
        'tr',
        'vi',
        'th',
        'ar',
        'hi',
        'id',
        'fil',
        'et',
      ]),
    )
  })

  it('applies Estonian and falls back Tagalog to Filipino', () => {
    applyLocale('et')
    expect(t('ui.language')).toBe('Keel')
    applyLocale('tl')
    expect(t('ui.language')).toBe('Wika')
    applyLocale('zh')
    expect(t('ui.language')).toBe('语言')
    applyLocale('id')
    expect(t('ui.language')).toBe('Bahasa')
    applyLocale('ar')
    expect(t('ui.language')).toBe('اللغة')
    applyLocale('ko')
    expect(t('ui.language')).toBe('언어')
    applyLocale('en')
  })

  it('maps locales to conventional flag countries', () => {
    expect(localeFlagIso('ja')).toBe('jp')
    expect(localeFlagIso('en')).toBe('us')
    expect(localeFlagIso('fil')).toBe('ph')
    expect(localeFlagIso('xx')).toBe('un')
  })
})
