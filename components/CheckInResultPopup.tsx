'use client'

import { useEffect } from 'react'
import {
    FaBan,
    FaCheckCircle,
    FaDoorOpen,
    FaMoneyBillWave,
    FaTimesCircle,
} from 'react-icons/fa'
import { PiWarningOctagonFill } from 'react-icons/pi'

export type CheckInAction = 'Ingresa' | 'Paga' | 'Rechazado' | 'Baneado'

export interface CheckInResult {
    kind: 'success' | 'error'
    items: string[]
    canConfirm: boolean
}

const actions: { label: CheckInAction; initial: string; icon: typeof FaDoorOpen }[] = [
    { label: 'Ingresa', initial: 'I', icon: FaDoorOpen },
    { label: 'Paga', initial: 'P', icon: FaMoneyBillWave },
    { label: 'Rechazado', initial: 'R', icon: FaTimesCircle },
    { label: 'Baneado', initial: 'B', icon: FaBan },
]

export default function CheckInResultPopup({
    result,
    onAction,
    onDismiss,
    actionPending = false,
}: {
    result: CheckInResult
    onAction: (action: CheckInAction) => void
    onDismiss: () => void
    actionPending?: boolean
}) {
    const isSuccess = result.kind === 'success'

    useEffect(() => {
        if (!result.canConfirm || actionPending) return

        function handleActionKeydown(event: KeyboardEvent) {
            if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return

            const key = event.key.toUpperCase()
            const action = actions.find(({ initial }) => initial === key)
            if (!action) return

            event.preventDefault()
            onAction(action.label)
        }

        window.addEventListener('keydown', handleActionKeydown)
        return () => window.removeEventListener('keydown', handleActionKeydown)
    }, [actionPending, onAction, result.canConfirm])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="check-in-result-title"
        >
            <div
                className={`w-full max-w-sm rounded-2xl border-4 p-6 text-center shadow-2xl ${isSuccess
                        ? 'border-green-300 bg-green-600'
                        : 'border-red-300 bg-red-600'
                    }`}
            >
                <div className="flex flex-col items-center gap-2">
                    {isSuccess ? (
                        <FaCheckCircle className="text-5xl text-green-50" />
                    ) : (
                        <PiWarningOctagonFill className="text-5xl text-red-50" />
                    )}
                    <p id="check-in-result-title" className="text-2xl font-bold text-white">
                        {isSuccess ? '¡Inscrito en el evento!' : '¡Atención!'}
                    </p>
                </div>

                {result.items.length > 0 && (
                    <div className="mt-4 space-y-1 text-4xl text-white">
                        {result.items.map((item, index) => (
                            <p key={`${item}-${index}`}>{item}</p>
                        ))}
                    </div>
                )}

                {result.canConfirm ? (
                    <>
                        <p className="mt-4 text-lg text-white/90">
                            Selecciona una acción o presiona I, P, R o B
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            {actions.map(({ label, initial, icon: Icon }) => (
                                <button
                                    key={label}
                                    type="button"
                                    aria-label={label}
                                    title={label}
                                    disabled={actionPending}
                                    className={`relative flex aspect-square w-full items-center justify-center rounded-xl border-2 border-white/70 text-white transition disabled:cursor-wait disabled:opacity-60 ${isSuccess ? 'bg-green-700 hover:bg-green-800' : 'bg-red-700 hover:bg-red-800'}`}
                                    onClick={() => onAction(label)}
                                >
                                    <Icon aria-hidden="true" className="text-5xl" />
                                    <span className="absolute right-2 top-2 flex h-8 min-w-8 items-center justify-center rounded-md border-2 border-white/80 px-1 font-serif text-xl font-black leading-none">
                                        {initial}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        className="mt-5 rounded-xl border-2 border-white/70 px-6 py-3 text-lg font-bold text-white transition hover:bg-white/10"
                        onClick={onDismiss}
                    >
                        Cerrar
                    </button>
                )}
            </div>
        </div>
    )
}
