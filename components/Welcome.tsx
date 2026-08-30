'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, formatHoraNocturna } from '@/lib/time'
import type { EventInfo, Guest, ImportMessages } from '@/lib/types'
import { PiWarningOctagonFill } from "react-icons/pi";
import { launchConfetti } from '@/app/utils/confeti'
import { FaCheckCircle } from 'react-icons/fa';
import { TbCameraSearch } from "react-icons/tb";
import { useRouter } from 'next/navigation';

type PopupKind = 'success' | 'error'
interface PopupState {
    kind: PopupKind
    items: string[]
}

function buildPopup(data: ImportMessages): PopupState | null {
    if (data.danger?.length) {
        return { kind: 'error', items: data.danger.map((d) => d.item) }
    }
    if (data.warning?.length) {
        return { kind: 'error', items: data.warning.map((w) => w.item) }
    }
    if (data.success?.length) {
        return { kind: 'success', items: data.success.map((s) => s.item) }
    }
    return null
}

export default function Welcome() {
  const router = useRouter();
  const [time, setTime] = useState('00:00:00')
  const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
  const [messages, setMessages] = useState<ImportMessages>({})
  const [guestToRegister, setGuestToRegister] = useState<Guest | false>(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [dudosa, setDudosa] = useState(false) // reemplaza leer "dudosa"/"feliz" del src de la imagen
  const [rutValue, setRutValue] = useState('')
  const [messageKey, setMessageKey] = useState(0);
  const clearMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Equivalente a la variable de módulo `cadena` del original. Un ref evita
  // relecturas de estado obsoletas dentro del handler de keydown.
  const cadenaRef = useRef('')
  const rutInputRef = useRef<HTMLInputElement>(null)

  const [popup, setPopup] = useState<PopupState | null>(null)

  // Equivalente al helper `noGender`
  const noGender = !guestToRegister ? true : !guestToRegister.gender ? false : true

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
        console.log("EVENTO ACTUAL", data);
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
    setMessages({})
    setGuestToRegister(false)
    setBloqueado(false)

    function handleWindowKeydown(e: KeyboardEvent) {
      if (e.key === "b") {
        document.getElementById('btn-ban')?.click()
      }      

      // Si el foco no está en el input del RUT (por ejemplo, el operador
      // hizo clic en otro lugar, o algún elemento robó el foco), lo
      // recuperamos para que el lector de código de barras -que dispara
      // estos mismos eventos de teclado a nivel global- siga funcionando
      // sin que alguien tenga que hacer clic manualmente en el campo.
      const input = rutInputRef.current
      if (input && document.activeElement !== input && !input.disabled) {
        input.focus()
      }
    }

    window.addEventListener('keydown', handleWindowKeydown)
    return () => window.removeEventListener('keydown', handleWindowKeydown)
  }, [])

  useEffect(() => {
    return () => {
      if (clearMessageTimer.current) {
        clearTimeout(clearMessageTimer.current);
      }
    };
  }, []);

  // --- Equivalente a la función evaluar(cadena) ---
  function evaluarCadena(cadena: string): string | false {
    const mascara = '0123456789'
    let legible = ''
    for (let i = 0; i < cadena.length; i++) {
      if (mascara.indexOf(cadena[i]) !== -1) legible += cadena[i]
    }
    console.log("LEGIBLE", legible);
    if (cadena.length < 7) return false

    if (cadena.substring(0, 4) === 'HTTP') {
      return legible.substring(0, 9)
    }
    return legible.substring(0, 9);
  }

  const registrarIngreso = useCallback(
    async (rut: string) => {
      setBloqueado(true);

      // Cancela el timer anterior si todavía existe
      if (clearMessageTimer.current) {
        clearTimeout(clearMessageTimer.current);
      }

      try {
        const res = await fetch('/api/events/check-in', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rut,
            dudosa,
          }),
        });

        const data = await res.json();

        console.log("DATA", data);

        setRutValue('');
        setGuestToRegister(false);

        // Fuerza un nuevo montaje del mensaje
        setMessageKey((prev) => prev + 1);
        setMessages(data);

        if (data?.success?.length) {
          launchConfetti({
            count: 180,
            duration: 2600,
            spread: 240,
          });
        }

        const nextPopup = buildPopup(data)
        setPopup(nextPopup)

        // 4 segundos: coincide exactamente con la animación
        clearMessageTimer.current = setTimeout(() => {
          setMessages({});
        }, 4000);

      } catch (err) {
        console.error('Error al registrar ingreso', err);

        setMessageKey((prev) => prev + 1);

        setMessages({
          danger: [
            {
              item: 'No se pudo contactar al servidor',
            },
          ],
        });

        clearMessageTimer.current = setTimeout(() => {
          setMessages({});
        }, 4000);

      } finally {
        setBloqueado(false);
        rutInputRef.current?.focus();
        setDudosa(false);
      }
    },
    [dudosa]
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

  function toggleBan() {
    setDudosa((prev) => !prev)
  }

  function handleSwitchMethod() {
    router.push("/welcome2");
  }

  const dismissPopup = useCallback(() => {
      setPopup(null)
      setBloqueado(false)
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
                Cierre de lista <b>{formatHoraNocturna(actualEvent.closeTime)}</b>
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
              <div className="boton-ban" style={{ display: 'inline-block', verticalAlign: 'top' }}>
                <div
                  id="btn-ban"
                  className={`${dudosa ? 'btn-danger border-red-700 bg-red-900' : 'btn-default border-blue-700 bg-blue-900'} border-2 w-24 rounded-xl p-4`}
                  onClick={toggleBan}
                >
                  <img
                    src={dudosa ? '/cara-dudosa.png' : '/cara-feliz.png'}
                    height={66}
                    alt="Estado"
                    className="invert"
                  />
                </div>
              </div>

            </div>
          </div>


          {/* Popup de resultado del check-in: verde para éxito, rojo para
                error/advertencia. Cubre toda la pantalla y un simple tap
                (en cualquier parte) lo cierra y reanuda el escaneo. */}
          {popup && (
              <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
                  role="alert"
                  onClick={dismissPopup}
              >
                  <div
                      className={`w-full max-w-sm rounded-2xl border-4 p-6 text-center shadow-2xl ${popup.kind === 'success'
                              ? 'border-green-300 bg-green-600'
                              : 'border-red-300 bg-red-600'
                          }`}
                  >
                      <div className="flex flex-col items-center gap-2">
                          {popup.kind === 'success' ? (
                              <FaCheckCircle className="text-5xl text-green-50" />
                          ) : (
                              <PiWarningOctagonFill className="text-5xl text-red-50" />
                          )}
                          <p className="text-2xl font-bold text-white">
                              {popup.kind === 'success' ? '¡Presente en la lista!' : '¡Atención!'}
                          </p>
                      </div>

                      {popup.items.length > 0 && (
                          <div className="mt-4 space-y-1 text-4xl text-white">
                              {popup.items.map((item, i) => (
                                  <p key={i}>{item}</p>
                              ))}
                          </div>
                      )}

                      <p className="mt-6 text-xl text-white/80">Toca para continuar</p>
                  </div>
              </div>
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
