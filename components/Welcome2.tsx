'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock, formatHoraNocturna } from '@/lib/time'
import type { EventInfo, Guest, ImportMessages } from '@/lib/types'
import { PiWarningOctagonFill } from "react-icons/pi";
import { launchConfetti } from '@/app/utils/confeti'
import { FaCheckCircle } from 'react-icons/fa';
import jsQR from 'jsqr'
import { useSoundPlayer } from "./context/SoundPlayerContext";

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

// Estado del popup de resultado del check-in: solo dos colores posibles
// (verde/rojo), agrupando "danger" y "warning" bajo el mismo tratamiento
// visual de error, tal como se pidió.
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

export default function Welcome2() {
    const [time, setTime] = useState('00:00:00')
    const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
    const [guestToRegister, setGuestToRegister] = useState<Guest | false>(false)
    const [bloqueado, setBloqueado] = useState(false)
    const [dudosa, setDudosa] = useState(false)
    const [rutValue, setRutValue] = useState('')
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [popup, setPopup] = useState<PopupState | null>(null)
    const { play } = useSoundPlayer();

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

    // Espejo en ref de `bloqueado`, para que el loop de escaneo (creado una
    // sola vez) siempre lea el valor más reciente sin quedar con una
    // clausura obsoleta.
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
        setPopup(null)
        setGuestToRegister(false)
        setBloqueado(false)

        function handleWindowKeydown(e: KeyboardEvent) {
            if (e.key === "b") {
                document.getElementById('btn-ban')?.click()
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

                const data = (await res.json()) as ImportMessages;

                console.log("DATA", data);

                setRutValue('');
                setGuestToRegister(false);

                if (data?.success?.length) {
                    play('/sounds/accept.mp3')
                    launchConfetti({
                        count: 180,
                        duration: 2600,
                        spread: 240,
                    });
                } else {
                    play('/sounds/error.mp3')
                }

                const nextPopup = buildPopup(data)
                setPopup(nextPopup)

                // Si por alguna razón el check-in no trajo ningún mensaje
                // (danger/warning/success vacíos), no habrá popup que el
                // operador pueda tocar para reanudar — se desbloquea de
                // inmediato para no dejar el escaneo trabado sin salida.
                if (!nextPopup) {
                    setBloqueado(false)
                }

            } catch (err) {
                console.log("ERRO!!!!")
                play('/sounds/error.mp3')
                console.error('Error al registrar ingreso', err);

                setPopup({
                    kind: 'error',
                    items: ['No se pudo contactar al servidor'],
                });
                // bloqueado permanece true: el popup de error también se
                // cierra con un tap, igual que el de éxito.

            } finally {
                setDudosa(false);
            }
        },
        [dudosa, play]
    );

    // Cierra el popup y libera el escaneo. Este es el único punto donde
    // `bloqueado` vuelve a false tras un registro — así el popup bloquea
    // nuevas lecturas mientras esté visible, y el operador decide
    // explícitamente cuándo continuar con un simple tap.
    const dismissPopup = useCallback(() => {
        setPopup(null)
        setBloqueado(false)
    }, [])

    // Espejo en ref de `registrarIngreso`, por la misma razón que
    // `bloqueadoRef`: el loop de escaneo vive fuera del ciclo normal de
    // renders de React.
    const registrarIngresoRef = useRef(registrarIngreso)
    useEffect(() => {
        registrarIngresoRef.current = registrarIngreso
    }, [registrarIngreso])

    const handleQrValue = useCallback((raw: string) => {
        if (bloqueadoRef.current) return

        const now = Date.now()
        const last = lastScanRef.current
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
                console.error('Error leyendo frame de la cámara', err)
            }

            if (value) {
                handleQrValue(value)
            }

            rafRef.current = requestAnimationFrame(detect)
        }

        rafRef.current = requestAnimationFrame(detect)
    }, [handleQrValue])

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

            <div className="relative flex items-center justify-center z-10 w-full h-screen px-4">
                <div className="w-full">
                    {!actualEvent && (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <img src="/logo.png" width={320} alt="Logo" />
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
                        <div className="flex flex-col items-center gap-3">

                            {/* Recuadro de cámara: sin cambios */}
                            <div className="relative w-72 h-72 overflow-hidden rounded-xl border-2 border-gray-500 bg-gray-900">
                                <video
                                    ref={videoRef}
                                    muted
                                    playsInline
                                    autoPlay
                                    className="h-full w-full object-cover"
                                />
                                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70" />
                            </div>

                            <canvas ref={canvasRef} style={{ display: 'none' }} />

                            {/* Input + cara feliz/dudosa: ancho acotado a
                                max-w-xs para que quepan cómodos en una
                                pantalla de celular angosta, alineados con
                                el ancho del recuadro de cámara. */}
                            <div className="flex w-full max-w-xs items-center justify-center gap-3">
                                <div id="div-rut" className="min-w-0 flex-1 text-left">
                                    <p className="text-sm sm:text-base">RUT</p>
                                    <input
                                        id="guest-rut"
                                        type="text"
                                        className="w-full border-2 border-gray-500 bg-gray-700 text-white rounded-xl p-3 text-lg sm:text-2xl"
                                        placeholder="Esperando QR..."
                                        value={rutValue}
                                        disabled={!!actualEvent?.cerrado}
                                        readOnly
                                    />
                                </div>
                                <div className="boton-ban shrink-0">
                                    <div
                                        id="btn-ban"
                                        className={`flex h-20 w-20 items-center justify-center rounded-xl border-2 p-2 ${dudosa ? 'btn-danger border-red-700 bg-red-900' : 'btn-default border-blue-700 bg-blue-900'
                                            }`}
                                        onClick={toggleBan}
                                    >
                                        <img
                                            src={dudosa ? '/cara-dudosa.png' : '/cara-feliz.png'}
                                            height={50}
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
    )
}