import { useSong } from '../context/SongContext'
import type { SnapValue } from '../music/types'
import { useT } from '../i18n/LanguageProvider'
import { AppMenu } from './AppMenu'

const SNAP_ITEMS = [
  { id: '4', label: '1/4' },
  { id: '8', label: '1/8' },
  { id: '16', label: '1/16' },
  { id: '32', label: '1/32' },
]

export function SnapSelect({
  triggerClassName = 'weather-select',
}: {
  triggerClassName?: string
}) {
  const { state, dispatch } = useSong()
  const { t } = useT()
  return (
    <AppMenu
      label={t('ui.snap')}
      value={String(state.snap)}
      items={SNAP_ITEMS}
      triggerClassName={triggerClassName}
      onChange={(id) => dispatch({ type: 'SET_SNAP', snap: parseInt(id, 10) as SnapValue })}
    />
  )
}
