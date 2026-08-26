'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, formatHoraNocturna } from '@/lib/time'
import type { EventInfo, Guest, ImportMessages } from '@/lib/types'
import { GoAlertFill } from "react-icons/go";
import { PiWarningOctagonFill } from "react-icons/pi";
import { launchConfetti } from '@/app/utils/confeti'
import { FaCheckCircle } from 'react-icons/fa';
import jsQR from 'jsqr'

// La API BarcodeDetector todavía no está en los tipos estándar del DOM en
// muchas versiones de TypeScript, así que se declara mínimamente acá.
// Solo existe en navegadores basados en Chromium (Chrome, Edge, Android);
// en el resto (Safari/iOS, Firefox) simplemente será `undefined` y el
// componente cae automáticamente al fallback con jsQR.
interface BarcodeDetectorResult {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

export default function Welcome2() {
  const [time, setTime] = useState('00:00:00')
  const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
  const [messages, setMessages] = useState<ImportMessages>({})
  const [guestToRegister, setGuestToRegister] = useState<Guest | false>(false)
  const [bloqueado, setBloqueado] = useState(false)
  const [dudosa, setDudosa] = useState(false)
  const [rutValue, setRutValue] = useState('')
  const [messageKey, setMessageKey] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const clearMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Equivalente al helper `noGender`
  const noGender = !guestToRegister ? true : !guestToRegister.gender ? false : true

  // --- Refs para la cámara y el loop de escaneo ---
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const barcodeDetectorRef = useRef<BarcodeDetectorLike | null>(null)
  const lastFrameAtRef = useRef(0)
  const lastScanRef = useRef<{ value: string; at: number } | null>(null)

  // Espejos en ref de estado que cambia seguido, para que el loop de
  // escaneo (creado una sola vez) siempre lea el valor más reciente sin
  // quedar con una clausura obsoleta — mismo problema que resolvía
  // `cadenaRef` en la versión con lector físico.
  const bloqueadoRef = useRef(bloqueado)
  useEffect(() => {
    bloqueadoRef.current = bloqueado
  }, [bloqueado])

  // --- Reloj (updateTime + setInterval) ---
  useEffect(() => {
    setTime(formatClock())
    const id = setInterval(() => setTime(formatClock()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- Evento actual: polling cada 30s ---
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
    setMessages({})
    setGuestToRegister(false)
    setBloqueado(false)

    // Atajo de teclado para marcar "dudosa", equivalente al de la versión
    // original — este sí tiene sentido mantenerlo, ya que no depende del
    // foco de ningún input (a diferencia del lector físico, aquí no hay
    // necesidad de devolver el foco a nada).
    function handleWindowKeydown(e: KeyboardEvent) {
      if (e.key === "b") {
        document.getElementById('btn-ban')?.click()
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

  // --- Equivalente a la función evaluar(cadena). Se mantiene igual porque
  // sigue siendo útil: un QR de cédula/carnet suele codificar una URL de
  // verificación (por eso el caso 'HTTP') o el RUT en texto plano con
  // puntos/guión, y esta función extrae los dígitos relevantes en ambos
  // casos. ---
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

        setMessageKey((prev) => prev + 1);

        setMessages(data);

        if (data?.success?.length) {
          launchConfetti({
            count: 180,
            duration: 2600,
            spread: 240,
          });
        }

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
        setDudosa(false);
      }
    },
    [dudosa]
  );

  // Espejo en ref de `registrarIngreso`, por la misma razón que `bloqueadoRef`:
  // el loop de escaneo vive fuera del ciclo normal de renders de React.
  const registrarIngresoRef = useRef(registrarIngreso)
  useEffect(() => {
    registrarIngresoRef.current = registrarIngreso
  }, [registrarIngreso])

  // --- Equivalente a 'keydown #guest-rut', pero disparado por un QR
  // detectado en vez de teclas individuales: acá no hay que armar la
  // cadena caracter a caracter (backspace, Enter, etc.) porque el QR
  // entrega el contenido completo de una sola vez. ---
  const handleQrValue = useCallback((raw: string) => {
    if (bloqueadoRef.current) return

    const now = Date.now()
    const last = lastScanRef.current
    // Evita reprocesar el mismo código mientras siga frente a la cámara
    // (el loop de escaneo corre muchas veces por segundo).
    if (last && last.value === raw && now - last.at < 5000) return
    lastScanRef.current = { value: raw, at: now }

    const procesado = evaluarCadena(raw)
    const rutFinal = procesado !== false ? procesado : raw
    if (procesado !== false) setRutValue(procesado)
    registrarIngresoRef.current(rutFinal)
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }, [])

  const scanLoop = useCallback(() => {
    const detect = async () => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(detect)
        return
      }

      // Throttle: sin esto, jsQR intentaría decodificar hasta 60
      // frames/segundo, lo cual es un gasto de CPU innecesario para un
      // QR que en la práctica no cambia entre frames consecutivos.
      const now = performance.now()
      if (now - lastFrameAtRef.current < 150) {
        rafRef.current = requestAnimationFrame(detect)
        return
      }
      lastFrameAtRef.current = now

      let value: string | null = null

      try {
        if (barcodeDetectorRef.current) {
          const codes = await barcodeDetectorRef.current.detect(video)
          if (codes.length > 0) value = codes[0].rawValue
        } else {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(imageData.data, imageData.width, imageData.height)
            if (result?.data) value = result.data
          }
        }
      } catch (err) {
        // Un frame fallido no es crítico, simplemente se reintenta en el
        // siguiente ciclo del loop.
        console.error('Error leyendo frame de la cámara', err)
      }

      if (value) {
        handleQrValue(value)
      }

      rafRef.current = requestAnimationFrame(detect)
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [handleQrValue])

  // --- Encendido/apagado de la cámara según si hay evento activo ---
  // NOTA/SUPUESTO: como no sabemos si EventInfo trae un id estable, se usa
  // `actualEvent?.name` + `actualEvent?.cerrado` como "llave" de dependencia
  // en vez del objeto completo. Esto es importante: el polling cada 30s
  // trae un objeto *nuevo* cada vez aunque el evento no haya cambiado, y si
  // dependiéramos del objeto completo, la cámara se reiniciaría cada 30s
  // innecesariamente. Si EventInfo tiene un campo id/_id, es preferible
  // usar ese en su lugar.
  useEffect(() => {
    if (!actualEvent || actualEvent.cerrado) {
      stopCamera()
      return
    }

    let cancelled = false

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador no soporta acceso a la cámara.')
        return
      }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          })
        } catch {
          // Si la cámara trasera no está disponible (por ejemplo en un
          // notebook), se intenta con cualquier cámara disponible.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        if (window.BarcodeDetector) {
          barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
        }

        setCameraError(null)
        setCameraReady(true)
        scanLoop()
      } catch (err) {
        console.error('No se pudo acceder a la cámara', err)
        setCameraError(
          'No se pudo acceder a la cámara. Revisa los permisos del navegador y que el sitio se sirva por HTTPS.'
        )
        setCameraReady(false)
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [!!actualEvent, actualEvent?.cerrado, scanLoop, stopCamera])

  function toggleBan() {
    setDudosa((prev) => !prev)
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
            <div className="flex flex-col items-center gap-3">

              <div className="relative w-72 h-72 overflow-hidden rounded-xl border-2 border-gray-500 bg-gray-900">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="h-full w-full object-cover"
                />
                {/* Guía visual para encuadrar el QR; puramente decorativa */}
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70" />
              </div>

              {/* Canvas oculto: solo se usa como buffer para decodificar
                  frames con jsQR cuando BarcodeDetector no está disponible.
                  Nunca se muestra al operador. */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="flex items-center gap-3">
                <div id="div-rut" className="text-left" style={{ width: 270 }}>
                  <p>RUT</p>
                  <input
                    id="guest-rut"
                    type="text"
                    className="border-2 border-gray-500 bg-gray-700 text-white rounded-xl p-3 text-2xl"
                    placeholder="Esperando código QR..."
                    value={rutValue}
                    disabled={!!actualEvent?.cerrado}
                    readOnly
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

              {cameraError && (
                <p className="max-w-xs text-center text-sm text-red-300">{cameraError}</p>
              )}
              {!cameraError && !cameraReady && (
                <p className="text-sm text-gray-400">Activando cámara...</p>
              )}
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
      </div>
    </div>
  )
}