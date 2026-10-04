'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock } from '@/lib/time'
import type { EventInfo, ImportMessages } from '@/lib/types'
import { launchConfetti } from '@/app/utils/confeti'
import jsQR from 'jsqr'
import { useSoundPlayer } from "./context/SoundPlayerContext";
import { format } from 'date-fns';
import CheckInResultPopup, { type CheckInAction, type CheckInResult } from './CheckInResultPopup'

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

export default function Welcome2() {
    const [time, setTime] = useState('00:00:00')
    const [actualEvent, setActualEvent] = useState<EventInfo | null>(null)
    const [bloqueado, setBloqueado] = useState(false)
    const [rutValue, setRutValue] = useState('')
    const [actionPending, setActionPending] = useState(false)
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [popup, setPopup] = useState<CheckInResult | null>(null)
    const { play } = useSoundPlayer();

    // --- Refs para la cámara y el loop de escaneo ---
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const rafRef = useRef<number | null>(null)
    const barcodeDetectorRef = useRef<BarcodeDetectorLike | null>(null)
    const lastFrameAtRef = useRef(0)
    const lastScanRef = useRef<{ value: string; at: number } | null>(null)
    const pendingRutRef = useRef('')

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
        setBloqueado(false)
        bloqueadoRef.current = false
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
            bloqueadoRef.current = true
            pendingRutRef.current = rut

            try {
                const res = await fetch('/api/events/check-in', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ rut }),
                });

                const data = (await res.json()) as CheckInResponse;

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
            }
        },
        [play]
    );

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
            const data = (await res.json()) as CheckInResponse

            if (!res.ok || !data.success?.length) {
                setPopup(buildPopup(data))
                play('/sounds/error.mp3')
                return
            }

            setPopup(null)
            setBloqueado(false)
            bloqueadoRef.current = false
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
        bloqueadoRef.current = false
        pendingRutRef.current = ''
        setRutValue('')
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
                                Cierre de lista <b>{format(actualEvent.listClosedAt, "HH:mm")}</b>
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

                            {/* Input: ancho acotado a
                                max-w-xs para que quepan cómodos en una
                                pantalla de celular angosta, alineados con
                                el ancho del recuadro de cámara. */}
                            <div className="flex w-full max-w-xs items-center justify-center">
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

            {popup && (
                <CheckInResultPopup
                    result={popup}
                    onAction={handlePopupAction}
                    onDismiss={dismissPopup}
                    actionPending={actionPending}
                />
            )}
        </div>
    )
}