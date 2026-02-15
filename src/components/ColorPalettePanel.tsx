import { useState, useRef, useCallback, useEffect } from 'react'
import { Box, Flex, Text, Heading, IconButton, Button, ScrollArea, Card, Separator } from '@radix-ui/themes'
import { Scissors, Merge, PenTool, ArrowRightLeft, X, GripHorizontal } from 'lucide-react'
import './ColorPalettePanel.css'

/* ====== Types ====== */
interface ChildCircle {
  color: string
  size: number
  x: number
  y: number
}

interface ClusterData {
  id: number
  main: string
  size: number
  children: ChildCircle[]
}

type DragSource =
  | { type: 'cluster'; clusterId: number }
  | { type: 'child'; clusterId: number; childIndex: number }

interface Position { x: number; y: number }

/* ====== Initial data ====== */
const INITIAL_CLUSTERS: ClusterData[] = [
  {
    id: 1, main: '#D4956A', size: 110,
    children: [
      { color: '#8B4513', size: 45, x: -20, y: 18 },
      { color: '#C47A4A', size: 30, x: 28, y: -15 },
    ],
  },
  {
    id: 2, main: '#E8B98A', size: 120,
    children: [
      { color: '#D4956A', size: 50, x: -25, y: 15 },
      { color: '#C9A882', size: 35, x: 28, y: 22 },
      { color: '#D2B48C', size: 25, x: -2, y: -28 },
    ],
  },
  {
    id: 3, main: '#F0B8C4', size: 95,
    children: [
      { color: '#E8889A', size: 40, x: 22, y: 8 },
      { color: '#D4748A', size: 28, x: -22, y: 20 },
    ],
  },
  {
    id: 4, main: '#C47A4A', size: 65,
    children: [{ color: '#8B4513', size: 30, x: 0, y: 12 }],
  },
  { id: 5, main: '#F5C9A8', size: 50, children: [] },
  {
    id: 6, main: '#1A1A1A', size: 105,
    children: [
      { color: '#3B3B00', size: 35, x: 18, y: 20 },
      { color: '#2A2A0A', size: 30, x: -22, y: 15 },
      { color: '#4A4A10', size: 25, x: 5, y: -22 },
    ],
  },
  {
    id: 7, main: 'checkerboard', size: 85,
    children: [{ color: '#1A1A1A', size: 30, x: -8, y: 8 }],
  },
  { id: 8, main: '#D4956A', size: 45, children: [] },
  {
    id: 9, main: '#E8B98A', size: 55,
    children: [{ color: '#D2B48C', size: 22, x: 10, y: 10 }],
  },
  { id: 10, main: '#F5DEB3', size: 40, children: [] },
]

let nextId = 100

/** Place children evenly around centre so they don't overlap */
function distributeChildren(parentSize: number, children: ChildCircle[]): ChildCircle[] {
  if (children.length === 0) return []
  const parentR = parentSize / 2
  return children.map((child, i) => {
    const angle = (2 * Math.PI * i) / children.length - Math.PI / 2
    const childR = child.size / 2
    const dist = Math.max(parentR * 0.35, parentR - childR - 4)
    return { ...child, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }
  })
}

function generatePresetColors(count: number): string[] {
  const base = [
    '#F5C9A8','#E0E0E0','#D4956A','#C47A4A','#E8B98A',
    '#F0B8C4','#D2B48C','#8B4513','#A0522D','#1A1A1A',
    '#F5DEB3','#DEB887','#D2691E','#CD853F','#BC8F8F',
    '#F4A460','#DAA520','#B8860B','#FFE4C4','#FFDEAD',
    '#FFE4B5','#FFDAB9','#EEE8AA','#F0E68C','#BDB76B',
    '#E6C89C','#D4A574','#C49A6C','#B08D5E','#9C8050',
    '#F2D5B8','#E0C3A6','#CEB194',
  ]
  return base.slice(0, count)
}

/* ====== Component ====== */
interface ColorPalettePanelProps { onClose: () => void }

export function ColorPalettePanel({ onClose }: ColorPalettePanelProps) {
  /* ---- panel drag ---- */
  const [pos, setPos] = useState<Position>({ x: 20, y: 60 })
  const [isPanelDrag, setIsPanelDrag] = useState(false)
  const panelOff = useRef<Position>({ x: 0, y: 0 })

  /* ---- data ---- */
  const [clusters, setClusters] = useState<ClusterData[]>(INITIAL_CLUSTERS)
  const [selectedPreset, setSelectedPreset] = useState(10)

  /* ---- drag (cluster or child) ---- */
  const [drag, setDrag] = useState<DragSource | null>(null)
  const [ghostPos, setGhostPos] = useState<Position>({ x: 0, y: 0 })
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const clusterEls = useRef<Map<number, HTMLDivElement>>(new Map())
  const dropRef = useRef<number | null>(null)
  const dragRef = useRef<DragSource | null>(null)
  const dragStartPos = useRef<Position>({ x: 0, y: 0 })

  useEffect(() => { dropRef.current = dropTargetId }, [dropTargetId])
  useEffect(() => { dragRef.current = drag }, [drag])

  /* ===== Panel drag ===== */
  const onPanelDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.palette-content')) return
    setIsPanelDrag(true)
    panelOff.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }, [pos])

  useEffect(() => {
    if (!isPanelDrag) return
    const move = (e: MouseEvent) =>
      setPos({ x: e.clientX - panelOff.current.x, y: e.clientY - panelOff.current.y })
    const up = () => setIsPanelDrag(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [isPanelDrag])

  /* ===== Circle / child drag start ===== */
  const onClusterDown = useCallback((e: React.MouseEvent, clusterId: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDrag({ type: 'cluster', clusterId })
    setGhostPos({ x: e.clientX, y: e.clientY })
  }, [])

  const onChildDown = useCallback((e: React.MouseEvent, clusterId: number, childIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDrag({ type: 'child', clusterId, childIndex })
    setGhostPos({ x: e.clientX, y: e.clientY })
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  /* ===== Drag move + drop logic ===== */
  useEffect(() => {
    if (!drag) return
    const srcClusterId = drag.clusterId

    const move = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY })
      let found: number | null = null
      clusterEls.current.forEach((el, id) => {
        // for cluster drag, skip self; for child drag, allow drop on same parent (to reorder) or other
        if (drag.type === 'cluster' && id === srcClusterId) return
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        if (Math.hypot(e.clientX - cx, e.clientY - cy) < r.width / 2) found = id
      })
      setDropTargetId(found)
    }

    const up = (e: MouseEvent) => {
      const target = dropRef.current
      const currentDrag = dragRef.current
      if (!currentDrag) { setDrag(null); setDropTargetId(null); return }

      if (currentDrag.type === 'cluster') {
        // Drop cluster onto another cluster → merge
        if (target !== null) {
          setClusters((prev) => {
            const src = prev.find((c) => c.id === currentDrag.clusterId)
            if (!src) return prev
            return prev
              .filter((c) => c.id !== currentDrag.clusterId)
              .map((c) => {
                if (c.id !== target) return c
                const newChild: ChildCircle = {
                  color: src.main === 'checkerboard' ? '#E0E0E0' : src.main,
                  size: Math.min(src.size * 0.4, c.size * 0.45),
                  x: 0, y: 0,
                }
                const extras: ChildCircle[] = src.children.map((ch) => ({
                  ...ch, size: Math.min(ch.size * 0.6, c.size * 0.3),
                }))
                const all = [...c.children, newChild, ...extras]
                return { ...c, children: distributeChildren(c.size, all) }
              })
          })
        }
      } else {
        // Dragging a child
        const { clusterId: parentId, childIndex } = currentDrag

        if (target !== null && target !== parentId) {
          // Drop child onto a DIFFERENT cluster → move child there
          setClusters((prev) => {
            const srcCluster = prev.find((c) => c.id === parentId)
            if (!srcCluster) return prev
            const child = srcCluster.children[childIndex]
            if (!child) return prev

            return prev.map((c) => {
              if (c.id === parentId) {
                // Remove child from source
                const newChildren = c.children.filter((_, i) => i !== childIndex)
                return { ...c, children: distributeChildren(c.size, newChildren) }
              }
              if (c.id === target) {
                // Add child to target
                const newChild: ChildCircle = {
                  color: child.color,
                  size: Math.min(child.size, c.size * 0.4),
                  x: 0, y: 0,
                }
                const all = [...c.children, newChild]
                return { ...c, children: distributeChildren(c.size, all) }
              }
              return c
            })
          })
        } else if (target === null) {
          // Drop on empty space → only promote if dragged far enough
          const dist = Math.hypot(
            e.clientX - dragStartPos.current.x,
            e.clientY - dragStartPos.current.y
          )
          if (dist > 50) {
            // Promote to new standalone cluster
            setClusters((prev) => {
            const srcCluster = prev.find((c) => c.id === parentId)
            if (!srcCluster) return prev
            const child = srcCluster.children[childIndex]
            if (!child) return prev

            const newId = nextId++
            const newCluster: ClusterData = {
              id: newId,
              main: child.color,
              size: Math.max(child.size * 1.5, 45),
              children: [],
            }

            return prev.map((c) => {
              if (c.id === parentId) {
                const newChildren = c.children.filter((_, i) => i !== childIndex)
                return { ...c, children: distributeChildren(c.size, newChildren) }
              }
              return c
            }).concat(newCluster)
          })
          }
          // else: minimal drag distance, cancel → child stays in place
        }
        // else: target === parentId → dropped on own parent, cancel → child stays in place
      }

      setDrag(null)
      setDropTargetId(null)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [drag])

  /* ===== Ghost data ===== */
  let ghostColor = ''
  let ghostSize = 0
  if (drag) {
    const src = clusters.find((c) => c.id === drag.clusterId)
    if (src) {
      if (drag.type === 'cluster') {
        ghostColor = src.main === 'checkerboard' ? '' : src.main
        ghostSize = src.size
      } else {
        const child = src.children[drag.childIndex]
        if (child) {
          ghostColor = child.color
          ghostSize = child.size
        }
      }
    }
  }

  const draggedCluster = drag?.type === 'cluster'
    ? clusters.find((c) => c.id === drag.clusterId)
    : null

  const presetNumbers = Array.from({ length: 33 }, (_, i) => i + 1)

  /* ===== Render ===== */
  function renderClusterContent(cluster: ClusterData) {
    const isChildDragSource = drag?.type === 'child' && drag.clusterId === cluster.id

    return (
      <>
        <Box
          className={`cluster-main ${cluster.main === 'checkerboard' ? 'checkerboard-circle' : ''}`}
          style={{
            width: cluster.size, height: cluster.size,
            backgroundColor: cluster.main !== 'checkerboard' ? cluster.main : undefined,
          }}
        />
        {cluster.children.map((child, ci) => {
          const isDraggedChild = isChildDragSource && drag.childIndex === ci
          return (
            <Box
              key={ci}
              className={`cluster-child${isDraggedChild ? ' child-dragging' : ''}`}
              style={{
                width: child.size, height: child.size,
                backgroundColor: child.color,
                left: `calc(50% + ${child.x}px - ${child.size / 2}px)`,
                top: `calc(50% + ${child.y}px - ${child.size / 2}px)`,
              }}
              onMouseDown={(e: React.MouseEvent) => onChildDown(e, cluster.id, ci)}
            />
          )
        })}
      </>
    )
  }

  return (
    <Card
      ref={panelRef}
      className="color-palette-panel"
      style={{ left: pos.x, top: pos.y, padding: 0 }}
      onMouseDown={onPanelDown}
    >
      {/* Drag header */}
      <Flex align="center" justify="center" className="palette-header">
        <GripHorizontal size={16} color="#bbb" />
      </Flex>

      <ScrollArea className="palette-content" scrollbars="vertical" style={{ maxHeight: 'calc(85vh - 28px)' }}>
        {/* Color circles */}
        <Flex align="center" justify="center" p="3" style={{ minHeight: 200, background: '#fff' }}>
          <Flex wrap="wrap" gap="1" align="center" justify="center" style={{ maxWidth: 440 }}>
            {clusters.map((cluster) => {
              const isClusterSrc = drag?.type === 'cluster' && drag.clusterId === cluster.id
              const isDrop = dropTargetId === cluster.id
              return (
                <Box
                  key={cluster.id}
                  ref={(el: HTMLDivElement | null) => { if (el) clusterEls.current.set(cluster.id, el); else clusterEls.current.delete(cluster.id) }}
                  className={`color-cluster${isClusterSrc ? ' cluster-dragging' : ''}${isDrop ? ' cluster-drop-target' : ''}`}
                  style={{ width: cluster.size, height: cluster.size }}
                  onMouseDown={(e: React.MouseEvent) => onClusterDown(e, cluster.id)}
                >
                  {renderClusterContent(cluster)}
                </Box>
              )
            })}
          </Flex>
        </Flex>

        {/* Drag ghost — cluster */}
        {drag?.type === 'cluster' && draggedCluster && (
          <Box
            className="circle-drag-ghost"
            style={{
              width: draggedCluster.size, height: draggedCluster.size,
              left: ghostPos.x - draggedCluster.size / 2,
              top: ghostPos.y - draggedCluster.size / 2,
            }}
          >
            {renderClusterContent(draggedCluster)}
          </Box>
        )}

        {/* Drag ghost — child (single circle) */}
        {drag?.type === 'child' && ghostSize > 0 && (
          <Box
            className="circle-drag-ghost child-ghost"
            style={{
              width: ghostSize, height: ghostSize,
              left: ghostPos.x - ghostSize / 2,
              top: ghostPos.y - ghostSize / 2,
              backgroundColor: ghostColor,
              borderRadius: '50%',
            }}
          />
        )}

        {/* Actions */}
        <Box>
          <Separator size="4" />
          <Flex align="center" justify="center" gap="2" py="3" px="4">
            <Button variant="ghost" color="blue" size="2" style={{ flexDirection: 'column', gap: 4 }}>
              <Flex align="center" gap="1">
                <Text size="1" weight="medium">Original</Text>
                <ArrowRightLeft size={16} />
                <Text size="1" weight="medium">Output</Text>
              </Flex>
            </Button>
            <Button variant="ghost" color="blue" size="2" style={{ flexDirection: 'column', gap: 4 }}>
              <Merge size={20} />
              <Text size="1">Merge</Text>
            </Button>
            <Button variant="ghost" color="blue" size="2" style={{ flexDirection: 'column', gap: 4 }}>
              <Scissors size={20} />
              <Text size="1">Split</Text>
            </Button>
            <Button variant="ghost" color="blue" size="2" style={{ flexDirection: 'column', gap: 4 }}>
              <PenTool size={20} />
              <Text size="1">Edit</Text>
            </Button>
          </Flex>
          <Separator size="4" />
        </Box>

        {/* Presets */}
        <Box p="4">
          <Heading size="3" mb="3">
            Palette Presets{' '}
            <Text size="1" color="gray" weight="regular">(by number of colors)</Text>
          </Heading>
          <Flex wrap="wrap" gap="1">
            {presetNumbers.map((num) => {
              const colors = generatePresetColors(num)
              const displayColor = colors[Math.min(num - 1, colors.length - 1)] || '#ccc'
              return (
                <button
                  key={num}
                  className={`preset-circle ${selectedPreset === num ? 'preset-selected' : ''}`}
                  style={{ backgroundColor: displayColor }}
                  onClick={() => setSelectedPreset(num)}
                  title={`${num} colors`}
                >
                  <Text size="1" weight="bold" style={{ color: '#333', textShadow: '0 0 3px rgba(255,255,255,0.9)', pointerEvents: 'none' }}>
                    {num}
                  </Text>
                </button>
              )
            })}
          </Flex>
        </Box>
      </ScrollArea>

      <IconButton
        variant="ghost"
        color="gray"
        size="1"
        onClick={onClose}
        aria-label="Close palette"
        style={{ position: 'absolute', top: 4, right: 8 }}
      >
        <X size={16} />
      </IconButton>
    </Card>
  )
}
