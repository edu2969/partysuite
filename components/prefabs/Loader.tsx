export default function Loader({
    text
}: {
    text?: string;
}) {
    return (<main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400 text-3xl">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-600 border-t-cyan-400" />
            <span className="-mt-1">{text ?? "Cargando..."}</span>
        </div>
    </main>)
}

