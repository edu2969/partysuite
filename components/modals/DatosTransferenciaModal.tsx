import { LiaTimesSolid  } from "react-icons/lia";

export default function DatosTransferenciaModal({
    show,
    onClose
}: {
    show: boolean,
    onClose: () => void
}) {
    return show && <div className="min-h-screen bg-white py-12 px-4 md:px-8">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-2xl space-y-6 relative">
                <button className="absolute right-4 top-4 cursor-pointer" onClick={onClose}>
                    <LiaTimesSolid className="text-[#16213E] text-2xl" />
                </button>
                {/* Título */}
                <div className="flex items-center gap-3 mt-6">
                    <span className="text-2xl">🏦</span>
                    <h3 className="text-xl font-bold text-[#0A1330]">Datos de Depósito</h3>
                    <span className="ml-auto bg-[#F4C20D] text-[#0A1330] text-[10px] font-bold px-3 py-1 rounded-full">
                        Transferencia
                    </span>
                </div>

                {/* Datos bancarios */}
                <div className="rounded-2xl bg-[#F5F9FF] border border-[#D9E5F3] overflow-hidden shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">Banco</span>
                            <span className="text-[#0A1330] font-bold">Banco Itaú</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">Nombre</span>
                            <span className="text-[#0A1330] font-bold">VIA CAPACITACION LTDA.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">Tipo de cuenta</span>
                            <span className="text-[#0A1330] font-bold">Cuenta Corriente</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">N° de cuenta</span>
                            <span className="text-[#0A1330] font-bold font-mono">0214175664</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">RUT</span>
                            <span className="text-[#0A1330] font-bold font-mono">76.809.468-3</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#16213E]/60 text-sm font-semibold min-w-25">E-mail comprobante</span>
                            <span className="text-[#0A1330] font-bold text-sm">facturacion@digitalceramic.cl</span>
                        </div>
                    </div>

                </div>

                {/* Información adicional */}
                <div className="rounded-2xl bg-[#F5F9FF] border border-[#D9E5F3] p-6 space-y-3">
                    <div className="flex items-start gap-3">
                        <span className="text-[#7C3AED] text-lg mt-0.5">📌</span>
                        <p className="text-[#16213E] text-sm leading-relaxed">
                            <span className="font-semibold">Importante:</span> Al recibir tu comprobante de pago,
                            iniciaremos la producción de tu trabajo.
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="text-[#F4C20D] text-lg mt-0.5">⚠️</span>
                        <p className="text-[#16213E] text-sm leading-relaxed">
                            <span className="font-semibold">Revisa bien</span> la información de tu caso antes de
                            confirmar el envío.
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="text-[#22B35E] text-lg mt-0.5">⏱️</span>
                        <p className="text-[#16213E] text-sm leading-relaxed">
                            <span className="font-semibold">Plazo de entrega:</span> El trabajo estará listo en
                            <span className="font-bold text-[#0A1330]"> 7 días corridos</span> a partir del día
                            de confirmación del depósito.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>;
}