import { Flex, IconButton, Button, Text, Separator, Badge, Tooltip } from '@radix-ui/themes'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import {
    Palette,
    ZoomIn,
    ZoomOut,
    Maximize,
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
    active,
    customStyle,
}: {
    icon: React.ComponentType<{ size?: number }>
    label: string
    onClick?: () => void
    badge?: string | number
    active?: boolean
    customStyle?: React.CSSProperties
}) {
    return (
        <Tooltip content={label}>
            <IconButton
                variant={active ? 'soft' : 'ghost'}
                color={active ? 'blue' : 'gray'}
                highContrast={!active}
                size="2"
                onClick={onClick}
                aria-label={label}
                style={{ ...customStyle }}
            >
                <Icon size={18} />
                {badge !== undefined && (
                    <Badge
                        size="1"
                        color="blue"
                        variant="solid"
                        radius="full"
                        style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            fontSize: 10,
                            minWidth: 18,
                            height: 18,
                            padding: '0 4px',
                        }}
                    >
                        {badge}
                    </Badge>
                )}
            </IconButton>
        </Tooltip>
    )
}

interface ToolbarProps {
    onPaletteToggle: () => void
    paletteOpen: boolean
    onZoomIn: () => void
    onZoomOut: () => void
    onZoomReset: () => void
    zoom: number
}

export function Toolbar({ onPaletteToggle, paletteOpen, onZoomIn, onZoomOut, onZoomReset, zoom }: ToolbarProps) {
    return (
        <Flex
            align="center"
            justify="between"
            px="2"
            style={{
                paddingLeft: 32,
                height: 60,
                background: '#fff',
                borderBottom: '1px solid #e5e5e5',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                zIndex: 10,
                flexShrink: 0,
            }}
        >
            <Flex align="center" gap="4">
                {/* Color palette / node count */}
                <ToolbarButton icon={Palette} label="Color Palette" badge={10} onClick={onPaletteToggle} active={paletteOpen} />
                {/* Zoom & fit controls */}
                <ToolbarButton
                    icon={ZoomIn}
                    label="Zoom In"
                    onClick={onZoomIn}
                />
                <Text size="1" weight="bold" color="gray" style={{ marginLeft: -12, marginRight: -12, minWidth: 40, textAlign: 'center', userSelect: 'none' }}>
                    {Math.round(zoom * 100)}%
                </Text>
                <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={onZoomOut} />
                <ToolbarButton icon={Maximize} label="Reset Zoom" onClick={onZoomReset} />
                <ToolbarButton icon={SlidersHorizontal} label="Adjustments" />

                <Separator orientation="vertical" size="2" style={{ height: 24, margin: '0 6px' }} />

                {/* Feedback */}
                <ToolbarButton icon={ThumbsUp} label="Like" />
                <ToolbarButton icon={ThumbsDown} label="Dislike" />
            </Flex>

            <Flex align="center" gap="2">
                <Button radius="large" variant="soft" style={{cursor: 'pointer'}}>
                    <Download size={18} />
                    <Text>DOWNLOAD</Text>
                </Button>
                <IconButton radius="large" variant="ghost" color="gray" highContrast aria-label="Close" size="3">
                    <X size={22} />
                </IconButton>
            </Flex>
        </Flex>
    )
}
