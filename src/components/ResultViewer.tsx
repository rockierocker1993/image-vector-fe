import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { Box, Flex, Heading, Text } from '@radix-ui/themes'
import './ResultViewer.css'

interface ResultViewerProps {
  zoom: number
  onWheelZoom: (delta: number) => void
  svgContent?: string | null
  fileName?: string | null
  viewMode: 'single' | 'split'
  originalImageUrl?: string | null
}

export function ResultViewer({ zoom, onWheelZoom, svgContent, fileName, viewMode, originalImageUrl }: ResultViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      onWheelZoom(e.deltaY)
    },
    [onWheelZoom]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      panStart.current = { ...pan }
    },
    [pan]
  )

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: MouseEvent) => {
      setPan({
        x: panStart.current.x + (e.clientX - dragStart.current.x),
        y: panStart.current.y + (e.clientY - dragStart.current.y),
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  const zoomPercent = Math.round(zoom * 100)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Observe container size to recalculate when browser resizes
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewMode])

  // Parse SVG intrinsic size and compute fitted dimensions
  const { normalizedSvg, fittedWidth, fittedHeight } = useMemo(() => {
    if (!svgContent) return { normalizedSvg: null, fittedWidth: 0, fittedHeight: 0 }

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')
    if (!svg) return { normalizedSvg: svgContent, fittedWidth: 0, fittedHeight: 0 }

    // Determine intrinsic size from viewBox or width/height attributes
    let svgW = 0, svgH = 0
    const vb = svg.getAttribute('viewBox')
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/)
      svgW = parseFloat(parts[2]) || 0
      svgH = parseFloat(parts[3]) || 0
    }
    if (!svgW || !svgH) {
      svgW = parseFloat(svg.getAttribute('width') || '0')
      svgH = parseFloat(svg.getAttribute('height') || '0')
    }

    // Ensure viewBox exists
    if (svgW && svgH && !svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)
    }

    // Fit into container, preserving aspect ratio
    // In split mode each panel is ~half the container width
    const availableW = viewMode === 'split' ? containerSize.w / 2 : containerSize.w
    const maxW = Math.max(availableW, 100)
    const maxH = Math.max(containerSize.h, 100)

    let fitW = maxW
    let fitH = maxH
    if (svgW && svgH) {
      const scale = Math.min(maxW / svgW, maxH / svgH)
      fitW = Math.round(svgW * scale)
      fitH = Math.round(svgH * scale)
    }

    svg.setAttribute('width', String(fitW))
    svg.setAttribute('height', String(fitH))
    svg.removeAttribute('style')

    return { normalizedSvg: svg.outerHTML, fittedWidth: fitW, fittedHeight: fitH }
  }, [svgContent, containerSize, viewMode])

  const emptyMessage = (
    <Text size="3" color="gray" style={{ userSelect: 'none' }}>
      Upload an image to see the vectorized result
    </Text>
  )

  const svgPanel = (
    <Box
      className="checkerboard"
      style={{
        width: fittedWidth || undefined,
        height: fittedHeight || undefined,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
      }}
    >
      <Flex align="center" justify="center">
        {normalizedSvg ? (
          <div
            className="result-image"
            dangerouslySetInnerHTML={{ __html: normalizedSvg }}
          />
        ) : emptyMessage}
      </Flex>
    </Box>
  )

  const originalPanel = (
    <Box
      className="checkerboard"
      style={{
        width: fittedWidth || undefined,
        height: fittedHeight || undefined,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
      }}
    >
      <Flex align="center" justify="center">
        {originalImageUrl ? (
          <img
            className="result-image"
            src={originalImageUrl}
            alt="Original"
            draggable={false}
            style={{ width: fittedWidth, height: fittedHeight, objectFit: 'contain' }}
          />
        ) : emptyMessage}
      </Flex>
    </Box>
  )

  return (
    <Flex direction="column" align="center" flexGrow="1" style={{ overflow: 'hidden', position: 'relative' }}>
      {viewMode === 'split' ? (
        <Flex
          ref={canvasRef}
          className={`result-canvas split-view${dragging ? ' is-dragging' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
        >
          <Flex align="center" justify="center" className="split-panel">
            <Text size="1" weight="bold" className="split-label">Original Image</Text>
            {originalPanel}
          </Flex>
          <Box className="split-divider" />
          <Flex align="center" justify="center" className="split-panel">
            <Text size="1" weight="bold" className="split-label">Vectorized Result</Text>
            {svgPanel}
          </Flex>
        </Flex>
      ) : (
        <Flex
          ref={canvasRef}
          align="center"
          justify="center"
          className={`result-canvas${dragging ? ' is-dragging' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
        >
          {svgPanel}
        </Flex>
      )}

      <Text size="2" color="gray" weight="regular" className="viewer-filename-label">
        {fileName ? `${fileName} — ${zoomPercent}%` : `${zoomPercent}%`}
      </Text>
    </Flex>
  )
}