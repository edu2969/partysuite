import { FiLoader } from "react-icons/fi";
import { LiaTimesSolid  } from "react-icons/lia";

export default function DeleteEventModal({
    show,
    isPending,
    onConfirm,
    onClose,
    eventName
}: {
    show: boolean,
    isPending: boolean,
    onConfirm: () => void,
    onClose: () => void,
    eventName: string;
}) {
    return (show ? <div className="w-full py-12 px-4 md:px-8 h-screen">
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="relative bg-white p-8 rounded-2xl space-y-6 min-w-lg">
                <button className="absolute right-4 top-4 cursor-pointer" onClick={onClose}>
                    <LiaTimesSolid className="text-[#16213E] text-2xl" />
                </button>
                {/* Título */}
                <div className="text-center mt-0">
                    <h3 className="text-xl font-bold text-[#0A1330]">Confirmación de eliminación</h3>                    
                    <p className="text-6xl text-orange-500">♲</p>
                </div>

                {/* Datos bancarios */}
                <div className="rounded-2xl bg-[#F5F9FF] border border-[#D9E5F3] overflow-hidden shadow-sm">
                    <p className="text-2xl text-neutral-800 max-w-xs px-5">
                        ¿Seguro desea eliminar el evento <b>{eventName}</b>?
                    </p>
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                    <button
                        className="text-2xl rounded-lg bg-neutral-400 px-6 py-3 font-semibold text-white transition hover:bg-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={isPending}
                        className="flex w-56 justify-center text-2xl rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={onConfirm}
                    >
                        {isPending ? <>
                            <FiLoader className="w-5 h-5 mt-2 mr-3 animate-spin" /> Confirmando...
                        </> : 'Confirmar'} 
                    </button>                    
                </div>
            </div>
        </div>
    </div> : null);
}