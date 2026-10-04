'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock } from '@/lib/time'
import type { EventInfo, ImportMessages } from '@/lib/types'
import { launchConfetti } from '@/app/utils/confeti'
import { TbCameraSearch } from "react-icons/tb";
import { useRouter } from 'next/navigation';
import { useSoundPlayer } from './context/SoundPlayerContext';
import { format } from 'date-fns';
import CheckInResultPopup, { type CheckInAction, type CheckInResult } from './CheckInResultPopup'

interface CheckInResponse extends ImportMessages {
  canConfirm?: boolean
}

function buildPopup(data: CheckInResponse): CheckInResult {
    if (data.danger?.length) {
        return { kind: 'error', items: data.danger.map((d) => d.item), canConfirm: data.canConfirm === true }
    }
    if (data.warning?.length) {
        return { kind: 'error', items: data.warning.map((w) => w.item), canConfirm: data.canConfirm === true }
    }
    if (data.success?.length) {
        return { kind: 'success', items: data.success.map((s) => s.item), canConfirm: data.canConfirm === true }
    }
    return { kind: 'error', items: ['No se recibió una respuesta válida'], canConfirm: false }
}

export default function Welcome() {
  const router = useRouter();
  const [time, setTime] = useState('00:00:00')
  const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
  const [bloqueado, setBloqueado] = useState(false)
  const [rutValue, setRutValue] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const { play } = useSoundPlayer();

  // Equivalente a la variable de módulo `cadena` del original. Un ref evita
  // relecturas de estado obsoletas dentro del handler de keydown.
  const cadenaRef = useRef('')
  const rutInputRef = useRef<HTMLInputElement>(null)
  const pendingRutRef = useRef('')
  const [popup, setPopup] = useState<CheckInResult | null>(null)
  const popupRef = useRef(popup)

  useEffect(() => {
    popupRef.current = popup
  }, [popup])

  // --- Reloj (updateTime + setInterval) ---
  useEffect(() => {
    setTime(formatClock())
    const id = setInterval(() => setTime(formatClock()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- Evento actual: Meteor lo mantenía reactivo con Events.findOne().
  // Aquí se simula con fetch + polling. Si necesitas tiempo real de verdad,
  // considera SWR con refreshInterval, o un WebSocket/SSE propio. ---
  useEffect(() => {
    let cancelled = false
    async function loadEvent() {
      try {
        const res = await fetch('/api/events/current')
        const data = await res.json()
        if (!cancelled) setActualEvent(data.event)
      } catch (err) {
        console.error('Error al cargar el evento actual', err)
      }
    }

    loadEvent()
    const id = setInterval(loadEvent, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    rutInputRef.current?.focus()
    setBloqueado(false)

    function handleWindowKeydown(e: KeyboardEvent) {
      // Si el foco no está en el input del RUT (por ejemplo, el operador
      // hizo clic en otro lugar, o algún elemento robó el foco), lo
      // recuperamos para que el lector de código de barras -que dispara
      // estos mismos eventos de teclado a nivel global- siga funcionando
      // sin que alguien tenga que hacer clic manualmente en el campo.
      const input = rutInputRef.current
      if (!popupRef.current && input && document.activeElement !== input && !input.disabled) {
        input.focus()
      }
    }

    window.addEventListener('keydown', handleWindowKeydown)
    return () => window.removeEventListener('keydown', handleWindowKeydown)
  }, [])

  // --- Equivalente a la función evaluar(cadena) ---
  function evaluarCadena(cadena: string): string | false {
    const mascara = '0123456789'
    let legible = ''
    for (let i = 0; i < cadena.length; i++) {
      if (mascara.indexOf(cadena[i]) !== -1) legible += cadena[i]
    }
    if (cadena.length < 7) return false

    if (cadena.substring(0, 4) === 'HTTP') {
      return legible.substring(0, 9)
    }
    return legible.substring(0, 9);
  }

  const registrarIngreso = useCallback(
    async (rut: string) => {
      setBloqueado(true);
      pendingRutRef.current = rut;

      try {
        const res = await fetch('/api/events/check-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rut }),
        });

        const data = await res.json() as CheckInResponse;

        setRutValue('');

        const nextPopup = buildPopup(data)
        setPopup(nextPopup)

        if (nextPopup.kind === 'error') {
          play('/sounds/error.mp3')
        }

      } catch (err) {
        play('/sounds/error.mp3')
        console.error('Error al registrar ingreso', err);

        setPopup({
          kind: 'error',
          items: ['No se pudo contactar al servidor'],
          canConfirm: false,
        });

      } finally {
        rutInputRef.current?.focus();
      }
    },
    [play]
  );

  // --- Equivalente a 'keydown #guest-rut' (captura del lector de código) ---
  function handleRutKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault()
    if (bloqueado) return

    const keycode = e.keyCode

    if (keycode === 8) {
      cadenaRef.current =
        cadenaRef.current.length > 0
          ? cadenaRef.current.substring(0, cadenaRef.current.length - 1)
          : ''
    } else if (keycode !== 13) {
      cadenaRef.current += String.fromCharCode(keycode)
    } else {
      const procesado = evaluarCadena(cadenaRef.current)
      const rutFinal = procesado !== false ? procesado : cadenaRef.current
      if (procesado !== false) setRutValue(procesado)
      registrarIngreso(rutFinal)
      cadenaRef.current = ''
    }
  }

  function handleSwitchMethod() {
    router.push("/welcome2");
  }

  const handlePopupAction = useCallback(async (action: CheckInAction) => {
    const rut = pendingRutRef.current
    if (!rut || actionPending) return

    setActionPending(true)
    try {
      const res = await fetch('/api/events/check-in/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, action }),
      })
      const data = await res.json() as CheckInResponse

      if (!res.ok || !data.success?.length) {
        setPopup(buildPopup(data))
        play('/sounds/error.mp3')
        return
      }

      setPopup(null)
      setBloqueado(false)
      pendingRutRef.current = ''
      setRutValue('')
      play('/sounds/accept.mp3')
      if (action === 'Ingresa' || action === 'Paga') {
        launchConfetti({ count: 180, duration: 2600, spread: 240 })
      }
    } catch (err) {
      console.error('Error al confirmar ingreso', err)
      setPopup({
        kind: 'error',
        items: ['No se pudo confirmar el check-in'],
        canConfirm: false,
      })
      play('/sounds/error.mp3')
    } finally {
      setActionPending(false)
    }
  }, [actionPending, play])

  const dismissPopup = useCallback(() => {
    setPopup(null)
    setBloqueado(false)
    pendingRutRef.current = ''
    setRutValue('')
  }, [])

  return (
    <div className="relative flex flex-col items-center justify-center h-screen w-full bg-black text-white">
      <div className="area absolute inset-0 z-0">
        <ul className="circles">
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
          <li></li>
        </ul>
      </div>

      <div className="relative flex items-center justify-center z-10 w-full h-screen px-4">
        <div className="w-full">
          {!actualEvent && (
            <div className="flex flex-col items-center justify-center gap-4">
              <img src="/ms-logo.png" width={320} alt="Logo" />
              <p className="text-3xl">Bienvenidos</p>
            </div>
          )}

          {/* Logo + info del evento: apilados y centrados, pensado
                        primero para mobile. El logo baja de 180 a 110px, y
                        los textos quedan debajo en vez de al lado. */}
          <div className="flex flex-col items-center gap-1 text-center" style={{ marginTop: 8 }}>
            {actualEvent && (
              <img src="/ms-logo.png" width={110} alt="Logo" className="mb-1" />
            )}
            <h4 className="text-xl sm:text-2xl font-semibold">
              {actualEvent ? actualEvent.name : 'NO HAY EVENTO HOY'}
            </h4>
            <p className="text-base sm:text-xl text-gray-300">Hora Actual</p>
            <p id="time" className="font-bold text-5xl sm:text-6xl">{time}</p>
            {actualEvent && (
              <h4 className="text-base sm:text-xl mt-1">
                Cierre de lista <b>{format(actualEvent.listClosedAt, "HH:mm")}</b>
              </h4>
            )}
          </div>

          <div className={`${actualEvent ? 'w-full mt-4' : 'hidden'}`}>
            <div className="flex justify-center">
              <div id="div-rut" className="text-left" style={{ width: 270 }}>
                <p>RUT</p>
                <input
                  id="guest-rut"
                  ref={rutInputRef}
                  type="text"
                  className={`border-2 border-gray-500 bg-gray-700 text-white rounded-xl p-3 text-2xl`}
                  placeholder='12.345.678-K'
                  value={rutValue}
                  disabled={!!actualEvent?.cerrado}
                  readOnly
                  onKeyDown={handleRutKeyDown}
                />
              </div>
            </div>
          </div>


          {popup && (
              <CheckInResultPopup
                result={popup}
                onAction={handlePopupAction}
                onDismiss={dismissPopup}
                actionPending={actionPending}
              />
          )}

        </div>
        <div className="absolute bottom-4 right-4">
          <button onClick={handleSwitchMethod}>
            <TbCameraSearch size={52} />
          </button>
        </div>
      </div>
    </div>
  )
}
