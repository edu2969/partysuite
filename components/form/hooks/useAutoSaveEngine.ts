"use client"

import { useCallback, useEffect, useRef } from "react"

export type AutoSavePayload = { changes: Record<string, any> }

type SaveFn = (payload: AutoSavePayload) => Promise<void>

type Options = {
  /** Espera tras el último cambio antes de enviar (ms). */
  debounceMs?: number
  /** Reintentos ante fallo de red/servidor. */
  maxRetries?: number
  /** Base del backoff entre reintentos (ms, se multiplica por el nº de intento). */
  retryDelayMs?: number
  onSaving?: () => void
  onSaved?: () => void
  /** willRetry indica si el motor va a reintentar automáticamente. */
  onError?: (err: unknown, willRetry: boolean) => void
}

/**
 * Motor único de autoguardado.
 *
 * - Cola por-campo (objeto): distintos campos se agrupan en UNA sola petición;
 *   el mismo campo se sobreescribe con su último valor.
 * - `setField` escribe en la cola de forma síncrona y (re)programa un flush con
 *   debounce → `flush()` inmediato tras `setField` siempre ve los cambios.
 * - `flush` serializa envíos con `isFlushing`; ante fallo hace rollback
 *   (reinsertando lo que no haya sido sobreescrito) y reintenta con backoff.
 */
export function useAutoSaveEngine(saveFn: SaveFn, options: Options = {}) {
  const {
    debounceMs = 500,
    maxRetries = 3,
    retryDelayMs = 1500,
    onSaving,
    onSaved,
    onError,
  } = options

  const queue = useRef<Record<string, any>>({})
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFlushing = useRef(false)
  const retryCount = useRef(0)

  // Mantener referencias frescas sin recrear los callbacks del motor.
  const saveFnRef = useRef(saveFn)
  const cbRef = useRef({ onSaving, onSaved, onError })
  useEffect(() => {
    saveFnRef.current = saveFn
    cbRef.current = { onSaving, onSaved, onError }
  })

  const flush = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = null
    }
    if (isFlushing.current) return
    if (Object.keys(queue.current).length === 0) return

    const batch = { ...queue.current }
    queue.current = {}
    isFlushing.current = true
    cbRef.current.onSaving?.()

    try {
      await saveFnRef.current({ changes: batch })
      retryCount.current = 0
      cbRef.current.onSaved?.()
    } catch (err) {
      // Rollback: reinsertar lo que no haya sido sobreescrito por cambios nuevos.
      for (const [field, value] of Object.entries(batch)) {
        if (!(field in queue.current)) queue.current[field] = value
      }
      const willRetry = retryCount.current < maxRetries
      cbRef.current.onError?.(err, willRetry)
      if (willRetry) {
        retryCount.current += 1
        if (retryTimer.current) clearTimeout(retryTimer.current)
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null
          void flush()
        }, retryDelayMs * retryCount.current)
      } else {
        retryCount.current = 0
      }
    } finally {
      isFlushing.current = false
      // Cambios acumulados durante el envío en vuelo → reprogramar.
      if (
        Object.keys(queue.current).length > 0 &&
        !debounceTimer.current &&
        !retryTimer.current
      ) {
        debounceTimer.current = setTimeout(() => {
          debounceTimer.current = null
          void flush()
        }, debounceMs)
      }
    }
  }, [debounceMs, maxRetries, retryDelayMs])

  const setField = useCallback(
    (field: string, value: any) => {
      queue.current[field] = value
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null
        void flush()
      }, debounceMs)
    },
    [debounceMs, flush]
  )

  // Limpieza + guardado de cambios pendientes al desmontar (fire-and-forget).
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (retryTimer.current) clearTimeout(retryTimer.current)
      const pending = queue.current
      if (Object.keys(pending).length > 0) {
        queue.current = {}
        void saveFnRef.current({ changes: { ...pending } }).catch(() => {})
      }
    }
  }, [])

  return { setField, flush }
}
