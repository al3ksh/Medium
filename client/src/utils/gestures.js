import { useRef, useCallback } from 'react'

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 40 }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    tracking.current = true
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (!tracking.current) return
    tracking.current = false
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX.current
    const dy = Math.abs(touch.clientY - startY.current)
    if (dy > Math.abs(dx)) return
    if (dx > threshold && onSwipeRight) onSwipeRight()
    if (dx < -threshold && onSwipeLeft) onSwipeLeft()
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchEnd }
}

export function useEdgeSwipe({ onEdgeSwipe, edgeWidth = 35 }) {
  const startX = useRef(0)
  const startY = useRef(0)
  const tracking = useRef(false)

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    if (touch.clientX <= edgeWidth) {
      startX.current = touch.clientX
      startY.current = touch.clientY
      tracking.current = true
    }
  }, [edgeWidth])

  const onTouchEnd = useCallback((e) => {
    if (!tracking.current) return
    tracking.current = false
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX.current
    const dy = Math.abs(touch.clientY - startY.current)
    if (dy > Math.abs(dx)) return
    if (dx > 25 && onEdgeSwipe) onEdgeSwipe()
  }, [onEdgeSwipe])

  return { onTouchStart, onTouchEnd }
}

export function useLongPress(callback, ms = 500) {
  const timerRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })

  const start = useCallback((e) => {
    const touch = e.touches ? e.touches[0] : e
    posRef.current = { x: touch.clientX, y: touch.clientY }
    timerRef.current = setTimeout(() => {
      callback(posRef.current)
    }, ms)
  }, [callback, ms])

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const move = useCallback((e) => {
    if (!timerRef.current) return
    const touch = e.touches ? e.touches[0] : e
    const dx = Math.abs(touch.clientX - posRef.current.x)
    const dy = Math.abs(touch.clientY - posRef.current.y)
    if (dx > 10 || dy > 10) cancel()
  }, [cancel])

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: move,
    onTouchCancel: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseMove: move,
    onMouseLeave: cancel,
  }
}
