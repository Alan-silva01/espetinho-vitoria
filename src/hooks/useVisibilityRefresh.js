import { useEffect, useRef } from 'react'

/**
 * Hook that calls a refresh callback when the page becomes visible again
 * after being hidden (e.g., OS sleep, tab switch, screen lock).
 * 
 * It detects "sleep" by checking if the time gap between the last hidden
 * event and the visible event exceeds a threshold (default: 30 seconds).
 * This prevents unnecessary re-fetches on quick tab switches.
 * 
 * @param {Function} onWake - callback to run when the page wakes from sleep
 * @param {Object} options
 * @param {number} options.sleepThresholdMs - minimum hidden time to consider a "sleep" (default 30s)
 */
export function useVisibilityRefresh(onWake, { sleepThresholdMs = 30_000 } = {}) {
    const hiddenAtRef = useRef(null)
    const callbackRef = useRef(onWake)

    // Keep callback ref fresh without re-subscribing the listener
    useEffect(() => {
        callbackRef.current = onWake
    }, [onWake])

    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                hiddenAtRef.current = Date.now()
            }

            if (document.visibilityState === 'visible') {
                const hiddenAt = hiddenAtRef.current
                const now = Date.now()

                // Only trigger if we KNOW it was hidden and the gap exceeds threshold
                if (hiddenAt && (now - hiddenAt) >= sleepThresholdMs) {
                    console.log(`[useVisibilityRefresh] Page woke after ${Math.round((now - hiddenAt) / 1000)}s — triggering refresh`)
                    callbackRef.current?.()
                }

                hiddenAtRef.current = null
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [sleepThresholdMs])
}
