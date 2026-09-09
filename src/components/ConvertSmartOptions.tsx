import { CircleHelp } from './icons'
import { AppMenu } from './AppMenu'
import { INSTRUMENTS, type InstrumentId, type Song } from '../music/types'
import { useT } from '../i18n/LanguageProvider'
import {
  SMART_PRESETS,
  markCustomIfChanged,
  withPreset,
  type SmartOptions,
  type SmartRole,
  type SmartTrackOverride,
  type OctaveNudge,
} from '../music/convert/smart/options'
import { resolveTrackRoles } from '../music/convert/smart/roles'

function Hint({ text }: { text: string }) {
  return (
    <span className="convert-hint" onClick={(e) => e.stopPropagation()}>
      <span className="convert-hint-btn" tabIndex={0} role="note" aria-label={text}>
        <CircleHelp size={14} strokeWidth={2} />
      </span>
      <span className="convert-hint-tip" role="tooltip">
        {text}
      </span>
    </span>
  )
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="convert-option">
      <label className="checkbox-row">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      <Hint text={hint} />
    </div>
  )
}

function SelectRow({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="convert-option convert-option-select">
      <label>
        <span>{label}</span>
        <AppMenu
          label={label}
          value={value}
          items={options}
          triggerClassName="convert-select"
          onChange={onChange}
        />
      </label>
      <Hint text={hint} />
    </div>
  )
}

function RangeRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="convert-option convert-option-range">
      <label>
        <span>
          {label} <em>{value}</em>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
      <Hint text={hint} />
    </div>
  )
}

const GT_INSTRUMENTS: InstrumentId[] = [
  'piano',
  'bass',
  'drums',
  'sax',
  'flute',
  'guitar',
  'electric-guitar',
  'violin',
  'lyre',
  'trumpet',
  'spooky',
  'winterfest',
]

const ROLES: SmartRole[] = ['auto', 'lead', 'harmony', 'bass', 'drums', 'pad']
const OCTAVES: { id: OctaveNudge; label: string }[] = [
  { id: -24, label: '−2' },
  { id: -12, label: '−1' },
  { id: 0, label: '0' },
  { id: 12, label: '+1' },
  { id: 24, label: '+2' },
]

function upsertTrack(smart: SmartOptions, trackId: string, patch: Partial<SmartTrackOverride>): SmartOptions {
  const prev = smart.tracks.find((row) => row.trackId === trackId)
  const row: SmartTrackOverride = {
    trackId,
    include: true,
    role: 'auto',
    octave: 0,
    ...prev,
    ...patch,
  }
  return markCustomIfChanged({
    ...smart,
    tracks: [...smart.tracks.filter((item) => item.trackId !== trackId), row],
  })
}

export function ConvertSmartOptions({
  smart,
  song,
  onChange,
}: {
  smart: SmartOptions
  song: Song
  onChange: (next: SmartOptions) => void
}) {
  const { t } = useT()
  const patch = (partial: Partial<SmartOptions>) => {
    onChange(markCustomIfChanged({ ...smart, ...partial }))
  }
  const roles = resolveTrackRoles(song, smart.tracks)
  const instrumentLabel = (id: InstrumentId) =>
    INSTRUMENTS.find((item) => item.id === id)?.label ?? id

  return (
    <div className="convert-smart">
      <section className="convert-section">
        <h4>{t('convert.section.presets')}</h4>
        <div className="convert-presets" role="list">
          {SMART_PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              className={`convert-preset${smart.preset === id ? ' is-on' : ''}`}
              onClick={() => onChange(withPreset(smart, id))}
            >
              {t(`convert.preset.${id}`)}
            </button>
          ))}
          {smart.preset === 'custom' ? (
            <span className="convert-preset is-custom">{t('convert.preset.custom')}</span>
          ) : null}
        </div>
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.arrangement')}</h4>
        <Check label={t('convert.fitKey')} hint={t('convert.fitKeyHint')} checked={smart.fitKey} onChange={(fitKey) => patch({ fitKey })} />
        <Check label={t('convert.lower')} hint={t('convert.lowerHint')} checked={smart.preferLow} onChange={(preferLow) => patch({ preferLow })} />
        <SelectRow
          label={t('convert.keyLock')}
          hint={t('convert.keyLockHint')}
          value={smart.keyLock}
          onChange={(keyLock) => patch({ keyLock: keyLock as SmartOptions['keyLock'] })}
          options={[
            { id: 'auto', label: t('convert.keyLockAuto') },
            { id: 'none', label: t('convert.keyLockNone') },
          ]}
        />
        <SelectRow
          label={t('convert.spelling')}
          hint={t('convert.spellingHint')}
          value={smart.accidentalSpelling}
          onChange={(accidentalSpelling) =>
            patch({ accidentalSpelling: accidentalSpelling as SmartOptions['accidentalSpelling'] })
          }
          options={[
            { id: 'auto', label: t('convert.spellingAuto') },
            { id: 'sharps', label: t('convert.spellingSharps') },
            { id: 'flats', label: t('convert.spellingFlats') },
            { id: 'key', label: t('convert.spellingKey') },
          ]}
        />
        <Check
          label={t('convert.splitAccidentals')}
          hint={t('convert.splitAccidentalsHint')}
          checked={smart.splitAccidentals}
          onChange={(splitAccidentals) => patch({ splitAccidentals })}
        />
        <SelectRow
          label={t('convert.padInstrument')}
          hint={t('convert.padInstrumentHint')}
          value={smart.padInstrument}
          onChange={(padInstrument) => patch({ padInstrument: padInstrument as SmartOptions['padInstrument'] })}
          options={[
            { id: 'piano', label: instrumentLabel('piano') },
            { id: 'spooky', label: instrumentLabel('spooky') },
          ]}
        />
        <SelectRow
          label={t('convert.bellInstrument')}
          hint={t('convert.bellInstrumentHint')}
          value={smart.bellInstrument}
          onChange={(bellInstrument) => patch({ bellInstrument: bellInstrument as SmartOptions['bellInstrument'] })}
          options={[
            { id: 'lyre', label: instrumentLabel('lyre') },
            { id: 'winterfest', label: instrumentLabel('winterfest') },
          ]}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.voices')}</h4>
        <RangeRow
          label={t('convert.chordCap')}
          hint={t('convert.chordCapHint')}
          value={smart.chordCap}
          min={1}
          max={4}
          onChange={(chordCap) => patch({ chordCap })}
        />
        <Check
          label={t('convert.unison')}
          hint={t('convert.unisonHint')}
          checked={smart.unisonCollapse}
          onChange={(unisonCollapse) => patch({ unisonCollapse })}
        />
        <Check
          label={t('convert.octaveDoubles')}
          hint={t('convert.octaveDoublesHint')}
          checked={smart.octaveDoubleCollapse}
          onChange={(octaveDoubleCollapse) => patch({ octaveDoubleCollapse })}
        />
        <SelectRow
          label={t('convert.padThin')}
          hint={t('convert.padThinHint')}
          value={smart.padThin}
          onChange={(padThin) => patch({ padThin: padThin as SmartOptions['padThin'] })}
          options={[
            { id: 'off', label: t('convert.padThinOff') },
            { id: 'medium', label: t('convert.padThinMedium') },
            { id: 'hard', label: t('convert.padThinHard') },
          ]}
        />
        <Check
          label={t('convert.melodyIsolation')}
          hint={t('convert.melodyIsolationHint')}
          checked={smart.melodyIsolation}
          onChange={(melodyIsolation) => patch({ melodyIsolation })}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.racks')}</h4>
        <Check
          label={t('convert.packRacks')}
          hint={t('convert.packRacksHint')}
          checked={smart.packRacks}
          onChange={(packRacks) => patch({ packRacks })}
        />
        <Check
          label={t('convert.mixRackVolume')}
          hint={t('convert.mixRackVolumeHint')}
          checked={smart.mixRackVolume}
          onChange={(mixRackVolume) => patch({ mixRackVolume })}
        />
        <Check
          label={t('convert.duckRacks')}
          hint={t('convert.duckRacksHint')}
          checked={smart.duckBusyRacks}
          onChange={(duckBusyRacks) => patch({ duckBusyRacks })}
        />
        <RangeRow
          label={t('convert.maxRackVoices')}
          hint={t('convert.maxRackVoicesHint')}
          value={smart.maxRackVoices}
          min={2}
          max={5}
          onChange={(maxRackVoices) => patch({ maxRackVoices })}
        />
        <SelectRow
          label={t('convert.sameInstrumentChords')}
          hint={t('convert.sameInstrumentChordsHint')}
          value={smart.sameInstrumentChords}
          onChange={(sameInstrumentChords) =>
            patch({ sameInstrumentChords: sameInstrumentChords as SmartOptions['sameInstrumentChords'] })
          }
          options={[
            { id: 'sheet', label: t('convert.chordsSheet') },
            { id: 'rack', label: t('convert.chordsRack') },
          ]}
        />
        <Check
          label={t('convert.neverRacks')}
          hint={t('convert.neverRacksHint')}
          checked={smart.neverRacks}
          onChange={(neverRacks) => patch({ neverRacks })}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.drums')}</h4>
        <Check
          label={t('convert.skipDrums')}
          hint={t('convert.skipDrumsHint')}
          checked={smart.skipDrums}
          onChange={(skipDrums) => patch({ skipDrums })}
        />
        <Check
          label={t('convert.compactKit')}
          hint={t('convert.compactKitHint')}
          checked={smart.compactKit}
          onChange={(compactKit) => patch({ compactKit })}
        />
        <Check
          label={t('convert.ghostHats')}
          hint={t('convert.ghostHatsHint')}
          checked={smart.dropGhostHats}
          onChange={(dropGhostHats) => patch({ dropGhostHats })}
        />
        <RangeRow
          label={t('convert.ghostHatVelocity')}
          hint={t('convert.ghostHatVelocityHint')}
          value={smart.ghostHatVelocity}
          min={1}
          max={80}
          onChange={(ghostHatVelocity) => patch({ ghostHatVelocity })}
        />
        <Check
          label={t('convert.kickSnare')}
          hint={t('convert.kickSnareHint')}
          checked={smart.kickSnarePriority}
          onChange={(kickSnarePriority) => patch({ kickSnarePriority })}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.cleanup')}</h4>
        <Check
          label={t('convert.trimSilence')}
          hint={t('convert.trimSilenceHint')}
          checked={smart.trimSilence}
          onChange={(trimSilence) => patch({ trimSilence })}
        />
        <Check
          label={t('convert.pickupTrim')}
          hint={t('convert.pickupTrimHint')}
          checked={smart.pickupTrim}
          onChange={(pickupTrim) => patch({ pickupTrim })}
        />
        <Check
          label={t('convert.dropQuiet')}
          hint={t('convert.dropQuietHint')}
          checked={smart.dropQuiet}
          onChange={(dropQuiet) => patch({ dropQuiet })}
        />
        <RangeRow
          label={t('convert.quietThreshold')}
          hint={t('convert.quietThresholdHint')}
          value={smart.quietThreshold}
          min={1}
          max={80}
          onChange={(quietThreshold) => patch({ quietThreshold })}
        />
        <SelectRow
          label={t('convert.grace')}
          hint={t('convert.graceHint')}
          value={smart.graceNotes}
          onChange={(graceNotes) => patch({ graceNotes: graceNotes as SmartOptions['graceNotes'] })}
          options={[
            { id: 'drop', label: t('convert.graceDrop') },
            { id: 'keep', label: t('convert.graceKeep') },
            { id: 'attach', label: t('convert.graceAttach') },
          ]}
        />
        <SelectRow
          label={t('convert.swing')}
          hint={t('convert.swingHint')}
          value={smart.swing}
          onChange={(swing) => patch({ swing: swing as SmartOptions['swing'] })}
          options={[
            { id: 'auto', label: t('convert.swingAuto') },
            { id: 'straight', label: t('convert.swingStraight') },
            { id: 'keep', label: t('convert.swingKeep') },
          ]}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.world')}</h4>
        <Check
          label={t('convert.compress')}
          hint={t('convert.compressHint')}
          checked={smart.compress}
          onChange={(compress) => patch({ compress })}
        />
        <SelectRow
          label={t('convert.targetLength')}
          hint={t('convert.targetLengthHint')}
          value={String(smart.targetColumns)}
          onChange={(value) =>
            patch({
              targetColumns: value === '200' ? 200 : value === '400' ? 400 : 'none',
            })
          }
          options={[
            { id: 'none', label: t('convert.targetNone') },
            { id: '400', label: t('convert.target400') },
            { id: '200', label: t('convert.target200') },
          ]}
        />
        <RangeRow
          label={t('convert.minBpm')}
          hint={t('convert.minBpmHint')}
          value={smart.minBpm}
          min={20}
          max={80}
          onChange={(minBpm) => patch({ minBpm })}
        />
        <Check
          label={t('convert.mergeInstruments')}
          hint={t('convert.mergeInstrumentsHint')}
          checked={smart.mergeSameInstruments}
          onChange={(mergeSameInstruments) => patch({ mergeSameInstruments })}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.output')}</h4>
        <Check
          label={t('convert.normalize')}
          hint={t('convert.normalizeHint')}
          checked={smart.normalize}
          onChange={(normalize) => patch({ normalize })}
        />
        <Check
          label={t('convert.flatten')}
          hint={t('convert.flattenHint')}
          checked={smart.flattenVelocities}
          onChange={(flattenVelocities) => patch({ flattenVelocities })}
        />
      </section>

      <section className="convert-section">
        <h4>{t('convert.section.tracks')}</h4>
        <div className="convert-tracks">
          <div className="convert-tracks-head">
            <span>{t('convert.trackOn')}</span>
            <span>{t('convert.trackName')}</span>
            <span>{t('convert.trackRole')}</span>
            <span>{t('convert.trackInstrument')}</span>
            <span>{t('convert.trackOctave')}</span>
          </div>
          {song.tracks.map((track) => {
            const row = smart.tracks.find((item) => item.trackId === track.id)
            const detected = roles.get(track.id) ?? 'harmony'
            return (
              <div key={track.id} className="convert-tracks-row">
                <input
                  type="checkbox"
                  checked={row?.include !== false}
                  aria-label={t('convert.trackOn')}
                  onChange={(e) => onChange(upsertTrack(smart, track.id, { include: e.target.checked }))}
                />
                <span className="convert-track-name" title={track.name}>
                  {track.name}
                  <em>{t(`convert.role.${detected}`)}</em>
                </span>
                <AppMenu
                  label={t('convert.trackRole')}
                  value={row?.role ?? 'auto'}
                  triggerClassName="convert-select"
                  items={ROLES.map((role) => ({ id: role, label: t(`convert.role.${role}`) }))}
                  onChange={(id) => onChange(upsertTrack(smart, track.id, { role: id as SmartRole }))}
                />
                <AppMenu
                  label={t('convert.trackInstrument')}
                  value={row?.instrument ?? track.instrument}
                  triggerClassName="convert-select"
                  items={GT_INSTRUMENTS.map((id) => ({ id, label: instrumentLabel(id) }))}
                  onChange={(id) =>
                    onChange(upsertTrack(smart, track.id, { instrument: id as InstrumentId }))
                  }
                />
                <AppMenu
                  label={t('convert.trackOctave')}
                  value={String(row?.octave ?? 0)}
                  triggerClassName="convert-select"
                  items={OCTAVES.map((oct) => ({ id: String(oct.id), label: oct.label }))}
                  onChange={(id) =>
                    onChange(upsertTrack(smart, track.id, { octave: Number(id) as OctaveNudge }))
                  }
                />
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export function smartExtraLabels(smart: SmartOptions, t: (path: string) => string): string[] {
  const extra: string[] = []
  if (smart.preset !== 'balanced' && smart.preset !== 'custom') extra.push(t(`convert.preset.${smart.preset}`))
  if (smart.compress) extra.push(t('convert.compress'))
  if (smart.fitKey) extra.push(t('convert.fitKey'))
  if (smart.preferLow) extra.push(t('convert.lower'))
  if (smart.melodyIsolation) extra.push(t('convert.melodyIsolation'))
  if (smart.neverRacks) extra.push(t('convert.neverRacks'))
  if (smart.skipDrums) extra.push(t('convert.skipDrums'))
  if (smart.trimSilence) extra.push(t('convert.trimSilence'))
  if (smart.dropQuiet) extra.push(t('convert.dropQuiet'))
  return extra
}
