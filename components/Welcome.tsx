'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, formatHoraNocturna } from '@/lib/time'
import type { EventInfo, Guest, ImportMessages } from '@/lib/types'

export default function Welcome() {
  const [time, setTime] = useState('00:00:00')
  const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
  const [messages, setMessages] = useState<ImportMessages | false>(false)
  const [guestToRegister, setGuestToRegister] = useState<Guest | false>(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [dudosa, setDudosa] = useState(false) // reemplaza leer "dudosa"/"feliz" del src de la imagen
  const [rutValue, setRutValue] = useState('')

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

  // --- Equivalente a Template.welcome.rendered (sin la parte de LaunchScreen,
  // que es una API exclusiva de Meteor Cordova sin equivalente en Next.js web) ---
  useEffect(() => {
    rutInputRef.current?.focus()
    setMessages(false)
    setGuestToRegister(false)
    setBloqueado(false)

    function handleWindowKeydown(e: KeyboardEvent) {
      if (e.keyCode === 32) {
        document.getElementById('btn-female')?.click()
      } else if (e.keyCode === 13) {
        document.getElementById('btn-male')?.click()
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
      return legible.substring(1, 9)
    }
    return legible.substring(0, 8)
  }

  // --- Equivalente a Meteor.call('RegistrarIngreso', ...) ---
  const registrarIngreso = useCallback(
    async (rut: string) => {
      setBloqueado(true)
      try {
        const res = await fetch('/api/registrar-ingreso', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rut, dudosa }),
        })
        const data: ImportMessages = await res.json()
        setRutValue('')
        setGuestToRegister(false)
        setMessages(data)
      } catch (err) {
        console.error('Error al registrar ingreso', err)
        setMessages({ danger: ['No se pudo contactar al servidor'] })
      } finally {
        setBloqueado(false)
        rutInputRef.current?.focus()
      }
    },
    [dudosa]
  )

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
      setRutValue(cadenaRef.current)
    } else if (keycode !== 13) {
      cadenaRef.current += String.fromCharCode(keycode)
      setRutValue(cadenaRef.current)
    } else {
      const procesado = evaluarCadena(cadenaRef.current)
      const rutFinal = procesado !== false ? procesado : cadenaRef.current
      if (procesado !== false) setRutValue(procesado)
      registrarIngreso(rutFinal)
      cadenaRef.current = ''
    }
  }

  // --- Equivalente a 'click #btn-ban' ---
  function toggleBan() {
    setDudosa((prev) => !prev)
  }

  // --- Equivalentes a 'click #btn-female' / 'click #btn-male'.
  // En tu código original ambos estaban comentados (sin efecto real);
  // se dejan aquí como stubs listos para activar. ---
  function handleFemaleClick() {
    // const guest: Guest = guestToRegister || {}
    // setGuestToRegister({ ...guest, gender: 'F' })
    // registrarIngreso(...)
  }

  function handleMaleClick() {
    // const guest: Guest = guestToRegister || {}
    // setGuestToRegister({ ...guest, gender: 'M' })
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-black text-white">
      <div className="flex flex-col items-center justify-center gap-4">
        <img src="/ms-logo.jpg" width={320} alt="Logo" /> 
        <p className="text-3xl">Bienvenidos</p>
      </div>

      <div className="text-3xl text-center" style={{ marginTop: 8 }}>
        <h4>{actualEvent ? actualEvent.name : 'NO HAY EVENTO HOY'}</h4>
        <h6>Hora Actual</h6>
        <p id="time" className="font-bold text-5xl">{time}</p>
        {actualEvent && <h4>Cierre de lista {formatHoraNocturna(actualEvent.closeTime)}</h4>}

        <div
          style={{
            width: 390,
            display: (actualEvent ? 'inline-block' : 'none'),
          }}
        >
          <div style={{ display: 'inline-block' }}>
            <div id="div-rut" className="input-group" style={{ width: 270 }}>
              <span className="input-group-addon">RUT</span>
              <input
                id="guest-rut"
                ref={rutInputRef}
                type="text"
                className={`form-control guestRut`}
                value={rutValue}
                disabled={!!actualEvent?.cerrado}
                readOnly
                onKeyDown={handleRutKeyDown}
              />
            </div>
          </div>
          <div className="boton-ban" style={{ display: 'inline-block', verticalAlign: 'top' }}>
            <a
              id="btn-ban"
              className={`btn ${dudosa ? 'btn-danger' : 'btn-default'}`}
              onClick={toggleBan}
            >
              <img
                src={dudosa ? '/img/cara-dudosa.png' : '/img/cara-feliz.png'}
                height={66}
                alt="Estado"
              />
            </a>
          </div>
        </div>
      </div>

      {messages && (
        <div className="col-xs-12">
          <div className="row">
            <div className="list-errors" style={{ paddingTop: 20 }}>
              {messages.danger && (
                <div className="alert alert-danger" role="alert">
                  {messages.danger.map((item, i) => (
                    <div key={i}>
                      <span className="glyphicon glyphicon-remove" /> {item}
                      <br />
                    </div>
                  ))}
                </div>
              )}
              {messages.warning && (
                <div className="alert alert-warning" role="alert">
                  {messages.warning.map((item, i) => (
                    <div key={i}>
                      <span className="glyphicon glyphicon-warning-sign" /> {item}
                      <br />
                    </div>
                  ))}
                </div>
              )}
              {messages.success && (
                <div className="alert alert-success" role="alert">
                  {messages.success.map((item, i) => (
                    <div key={i}>
                      <span className="glyphicon glyphicon-ok" /> {item}
                      <br />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
