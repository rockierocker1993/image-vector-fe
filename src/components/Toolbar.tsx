import * as ToggleGroup from '@radix-ui/react-toggle-group'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Separator from '@radix-ui/react-separator'
import {
  Layers,
  Triangle,
  Columns2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Crop,
  SlidersHorizontal,
  ThumbsUp,
  ThumbsDown,
  Download,
  X,
} from 'lucide-react'
import './Toolbar.css'

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick?: () => void
  badge?: string | number
}) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button className="toolbar-btn" onClick={onClick} aria-label={label}>
            <Icon size={18} />
            {badge !== undefined && <span className="toolbar-badge">{badge}</span>}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" sideOffset={5}>
            {label}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export function Toolbar() {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        {/* Layers / node count */}
        <ToolbarButton icon={Layers} label="Layers" badge={10} />

        <Separator.Root className="toolbar-separator" orientation="vertical" />

        {/* View mode toggle */}
        <ToggleGroup.Root
          className="toggle-group"
          type="single"
          defaultValue="single"
          aria-label="View mode"
        >
          <ToggleGroup.Item className="toggle-group-item" value="single" aria-label="Single view">
            <Triangle size={18} />
          </ToggleGroup.Item>
          <ToggleGroup.Item className="toggle-group-item" value="split" aria-label="Split view">
            <Columns2 size={18} />
          </ToggleGroup.Item>
        </ToggleGroup.Root>

        <Separator.Root className="toolbar-separator" orientation="vertical" />

        {/* Zoom & fit controls */}
        <ToolbarButton icon={ZoomIn} label="Zoom In" />
        <ToolbarButton icon={ZoomOut} label="Zoom Out" />
        <ToolbarButton icon={Maximize} label="Fit to Screen" />
        <ToolbarButton icon={Crop} label="Crop" />
        <ToolbarButton icon={SlidersHorizontal} label="Adjustments" />

        <Separator.Root className="toolbar-separator" orientation="vertical" />

        {/* Feedback */}
        <ToolbarButton icon={ThumbsUp} label="Like" />
        <ToolbarButton icon={ThumbsDown} label="Dislike" />
      </div>

      <div className="toolbar-right">
        <button className="download-btn">
          <Download size={18} />
          <span>DOWNLOAD</span>
        </button>
        <button className="close-btn" aria-label="Close">
          <X size={22} />
        </button>
      </div>
    </div>
  )
}
