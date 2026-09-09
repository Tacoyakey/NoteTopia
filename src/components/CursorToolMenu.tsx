import { useSong } from '../context/SongContext'
import { showActionToast } from './actionToast'
import { EDIT_TOOL_DEFS, WORLD_TOOL_DEFS } from './editToolDefs'
import { ToolDropdown } from './ToolDropdown'
import { useT } from '../i18n/LanguageProvider'

export function CursorToolMenu({ drop = 'down' }: { drop?: 'up' | 'down' }) {
  const { state, dispatch } = useSong()
  const { t } = useT()

  if (state.mode === 'world') {
    return (
      <div className="cursor-tool-menu" data-tour="world-tools">
        <ToolDropdown
          label={t('ui.worldTools')}
          drop={drop}
          align="right"
          value={state.worldTool}
          onChange={(tool) => {
            dispatch({ type: 'SET_WORLD_TOOL', tool })
            const item = WORLD_TOOL_DEFS.find((def) => def.id === tool)
            if (item) showActionToast(t(item.labelKey))
          }}
          items={WORLD_TOOL_DEFS.map((tool) => ({
            id: tool.id,
            icon: tool.icon,
            label: t(tool.labelKey),
            title: t(tool.titleKey),
          }))}
        />
      </div>
    )
  }

  return (
    <div className="cursor-tool-menu">
      <ToolDropdown
        label={t('ui.editTools')}
        drop={drop}
        value={state.editTool}
          onChange={(tool) => {
            dispatch({ type: 'SET_EDIT_TOOL', tool })
            const item = EDIT_TOOL_DEFS.find((def) => def.id === tool)
            if (item) showActionToast(t(item.labelKey))
          }}
        items={EDIT_TOOL_DEFS.map((tool) => ({
          id: tool.id,
          icon: tool.icon,
          label: t(tool.labelKey),
          title: t(tool.titleKey),
        }))}
      />
    </div>
  )
}
