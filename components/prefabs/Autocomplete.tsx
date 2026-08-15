"use client"

import { useEffect, useRef, useState } from "react"

type Option = {
  id: string
  label: string
  sublabel?: string
  /** Dato de paso opcional que el consumidor puede leer en onSelect. */
  fechaNacimiento?: string | null
}

type Props = {
  value: string
  onChange: (text: string) => void
  onSelect: (option: Option | null) => void
  onBlur?: (value: string) => void
  fetchOptions: (q: string) => Promise<Option[]>
  placeholder?: string
  className?: string
  tabIndex?: number
}

export default function Autocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  fetchOptions,
  placeholder,
  className,
  tabIndex
}: Props) {
  const [options, setOptions] = useState<Option[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isSelectingRef = useRef(false) // ← NUEVO: para evitar llamar onSelect(null) durante escritura

  useEffect(() => {
    if (!open) return

    let cancel = false
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        const res = await fetchOptions(value)
        if (!cancel) {
          setOptions(res)
          setLoading(false)
        }
      })()
    }, 200)

    return () => {
      cancel = true
      window.clearTimeout(t)
    }
  }, [value, open, fetchOptions])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        tabIndex={tabIndex}
        onChange={(e) => {
          const newValue = e.target.value
          onChange(newValue)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          onBlur?.(value)
          setOpen(false)
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {open && (options.length > 0 || loading) && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && (
            <li className="px-4 py-2 text-sm text-gray-400">Buscando…</li>
          )}

          {!loading &&
            options.map((o) => (
              <li
                key={o.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // El valor del campo lo fija el consumidor en onSelect (para
                  // el paciente, solo el nombre; para la clínica, la etiqueta).
                  // No forzamos onChange aquí para no sobreescribir ese valor.
                  isSelectingRef.current = true
                  onSelect(o)
                  setOpen(false)
                  setTimeout(() => {
                    isSelectingRef.current = false
                  }, 100)
                }}
                className="cursor-pointer px-4 py-2 hover:bg-blue-50"
              >
                <p className="text-sm font-semibold text-gray-800">
                  {o.label}
                </p>
                {o.sublabel && (
                  <p className="text-xs text-gray-500">{o.sublabel}</p>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}