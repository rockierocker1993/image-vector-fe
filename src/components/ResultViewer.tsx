import { useRef, useCallback, useState, useEffect } from 'react'
import { Box, Flex, Heading, Text } from '@radix-ui/themes'
import './ResultViewer.css'

interface ResultViewerProps {
  zoom: number
  onWheelZoom: (delta: number) => void
  svgContent?: string | null
  fileName?: string | null
}

export function ResultViewer({ zoom, onWheelZoom, svgContent, fileName }: ResultViewerProps) {
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

  return (
    <Flex direction="column" align="center" flexGrow="1" style={{ overflow: 'hidden', padding: 16 }}>
      <Heading size="3" weight="medium" color="gray" mb="3" style={{ letterSpacing: 0.2 }}>
      </Heading>

      <Box
        ref={canvasRef}
        className={`result-canvas${dragging ? ' is-dragging' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <Box
          className="checkerboard"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <Flex align="center" justify="center">
            {svgContent ? (
              <div
                className="result-image"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : (
              <Text size="3" color="gray" style={{ userSelect: 'none' }}>
                Upload an image to see the vectorized result
              </Text>
            )}
          </Flex>
        </Box>
      </Box>

      <Text size="2" color="gray" mt="3" weight="regular">
        {fileName ? `${fileName} — ${zoomPercent}%` : `${zoomPercent}%`}
      </Text>
    </Flex>
  )
}