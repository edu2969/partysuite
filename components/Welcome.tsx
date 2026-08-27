'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, formatHoraNocturna } from '@/lib/time'
import type { EventInfo, Guest, ImportMessages } from '@/lib/types'
import { GoAlertFill } from "react-icons/go";
import { PiWarningOctagonFill } from "react-icons/pi";
import { launchConfetti } from '@/app/utils/confeti'
import { FaCheckCircle } from 'react-icons/fa';
import { TbCameraSearch } from "react-icons/tb";
import { useRouter } from 'next/navigation';

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

      <div className="relative flex items-center justify-center z-10 w-full h-screen">
        <div>
          {!actualEvent && <div className="flex flex-col items-center justify-center gap-4">
            <img src="/logo.png" width={320} alt="Logo" />
            <p className="text-3xl">Bienvenidos</p>
          </div>}

          <div className={`${actualEvent ? 'grid grid-cols-2 text-3xl' : 'text-center'}`} style={{ marginTop: 8 }}>
            <div className={`${actualEvent ? 'text-center' : 'text-right'}`}>
              {actualEvent && <div className="flex justify-end gap-4">
                <img src="/logo.png" width={180} alt="Logo" />
              </div>}
            </div>
            <div className={actualEvent ? 'text-left' : 'text-center'}>
              <h4>{actualEvent ? actualEvent.name : 'NO HAY EVENTO HOY'}</h4>
              <p className="text-xl">Hora Actual</p>
              <p id="time" className="font-bold text-6xl">{time}</p>
              {actualEvent && <h4>Cierre de lista <b>{formatHoraNocturna(actualEvent.closeTime)}</b></h4>}
            </div>
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


          {Object.keys(messages).length > 0 && (
            <div
              key={messageKey}
              className="fixed bottom-0 text-2xl pb-10 animate-fader-out-75"
            >
              <div className="list-errors" style={{ paddingTop: 20 }}>
                {messages.danger && (
                  <div className="alert alert-danger" role="alert">
                    <div className="flex gap-4 text-red-300 text-lg">
                      <PiWarningOctagonFill /><span className="-mt-1">¡Atención!</span>
                    </div>
                    {messages.danger?.map((danger, i) => (
                      <div key={`danger_${i}`} className="flex text-red-200 text-2xl">
                        <span className="ml-4 -mt-1">• {danger.item}</span>
                      </div>
                    ))}
                  </div>
                )}
                {messages.warning && (
                  <div className="alert alert-warning" role="alert">
                    <div className="flex gap-4 text-red-300 text-lg">
                      <GoAlertFill /><span className="-mt-1">¡Atención!</span>
                    </div>
                    {messages.warning?.map((warning, i) => (
                      <div key={`warning_${i}`}>
                        <span className="glyphicon glyphicon-warning-sign" /> {warning.item}
                        <br />
                      </div>
                    ))}
                  </div>
                )}
                {messages.success && (
                  <div className="alert alert-success" role="alert">
                    <div className="flex gap-4 text-green-300 text-lg">
                      <FaCheckCircle /><span className="-mt-1">¡Presente en la lista!</span>
                    </div>
                    {messages.success?.map((success, i) => (
                      <div key={`alert_${i}`}>
                        <span className="glyphicon glyphicon-ok" /> {success.item}
                        <br />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>)}

        </div>
        <div className="absolute bottom-4 right-4">
          <button onClick={handleSwitchMethod}>
            <TbCameraSearch size={52}/>
          </button>
        </div>
      </div>
    </div>
  )
}
