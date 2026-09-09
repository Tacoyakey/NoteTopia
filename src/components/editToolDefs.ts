import type { ComponentType } from 'react'
import type { EditTool, WorldTool } from '../context/SongContext'
import { Hammer, MousePointer2, Pencil, Split } from './icons'

type ToolDef<T extends string> = {
  id: T
  icon: ComponentType<{ size?: number }>
  labelKey: string
  titleKey: string
}

export const EDIT_TOOL_DEFS: ToolDef<EditTool>[] = [
  { id: 'select', icon: MousePointer2, labelKey: 'ui.toolSelect', titleKey: 'ui.toolSelectHint' },
  { id: 'draw', icon: Pencil, labelKey: 'ui.toolDraw', titleKey: 'ui.toolDrawHint' },
  { id: 'slice', icon: Split, labelKey: 'ui.toolSlice', titleKey: 'ui.toolSliceHint' },
]

export const WORLD_TOOL_DEFS: ToolDef<WorldTool>[] = [
  { id: 'build', icon: Hammer, labelKey: 'ui.build', titleKey: 'ui.buildTitle' },
  { id: 'select', icon: MousePointer2, labelKey: 'ui.toolSelect', titleKey: 'ui.exploreTitle' },
  { id: 'draw', icon: Pencil, labelKey: 'ui.toolDraw', titleKey: 'ui.toolDrawHint' },
  { id: 'slice', icon: Split, labelKey: 'ui.toolSlice', titleKey: 'ui.toolSliceHint' },
]

export const WORLD_TOOLS: WorldTool[] = WORLD_TOOL_DEFS.map((item) => item.id)
export const EDIT_TOOLS: EditTool[] = EDIT_TOOL_DEFS.map((item) => item.id)

export function parseWorldTool(tool: string | undefined): WorldTool {
  if (tool === 'explore') return 'select'
  if (tool === 'draw' || tool === 'slice' || tool === 'build' || tool === 'select') return tool
  return 'select'
}
