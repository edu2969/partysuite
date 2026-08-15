"use client";

import React, {
  forwardRef,
  useEffect,
  useState,
} from "react";

interface RutInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const cleanRut = (rut: string) => {
  return rut
    .replace(/[^0-9kK]/g, "")
    .toUpperCase();
};

const formatRut = (rut: string) => {
  const cleaned = cleanRut(rut);

  if (cleaned.length <= 1) {
    return cleaned;
  }

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  const formattedBody = body.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );

  return `${formattedBody}-${dv}`;
};

const calculateDV = (rutBody: string) => {
  let sum = 0;
  let multiplier = 2;

  for (
    let i = rutBody.length - 1;
    i >= 0;
    i--
  ) {
    sum += Number(rutBody[i]) * multiplier;

    multiplier =
      multiplier === 7
        ? 2
        : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return "0";

  if (remainder === 10) return "K";

  return remainder.toString();
};

const isValidRut = (rut: string) => {
  const cleaned = cleanRut(rut);

  if (cleaned.length < 2) {
    return true;
  }

  const body = cleaned.slice(0, -1);

  const dv = cleaned
    .slice(-1)
    .toUpperCase();

  if (!/^\d+$/.test(body)) {
    return false;
  }

  return calculateDV(body) === dv;
};

const RutInput = forwardRef<
  HTMLInputElement,
  RutInputProps
>(
  (
    {
      className = "",
      onChange,
      onBlur,
      value,
      disabled,
      placeholder = "Ej: 12.345.678-5",
      name,
      ...props
    },
    ref
  ) => {

    const [isFocused, setIsFocused] =
      useState(false);

    const [internalValue, setInternalValue] =
      useState(
        formatRut(String(value ?? ""))
      );

    useEffect(() => {
      setInternalValue(
        formatRut(String(value ?? ""))
      );
    }, [value]);

    const valid =
      isValidRut(internalValue);

    const handleChange = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {

      const cleaned = cleanRut(
        e.target.value
      );

      if (cleaned.length > 9) {
        return;
      }

      const formatted =
        formatRut(cleaned);

      setInternalValue(formatted);

      onChange?.({
        ...e,
        target: {
          ...e.target,
          name,
          value: formatted,
        },
        currentTarget: {
          ...e.currentTarget,
          name,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>);
    };

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement>
    ) => {

      const allowedKeys = [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];

      if (
        allowedKeys.includes(e.key)
      ) {
        return;
      }

      if (
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }

      const isNumber =
        e.key >= "0" &&
        e.key <= "9";

      const isK =
        e.key === "k" ||
        e.key === "K";

      if (!isNumber && !isK) {
        e.preventDefault();
      }
    };

    const handlePaste = (
      e: React.ClipboardEvent<HTMLInputElement>
    ) => {

      e.preventDefault();

      const pastedText =
        e.clipboardData.getData("text");

      const cleaned =
        cleanRut(pastedText);

      if (cleaned.length > 9) {
        return;
      }

      const formatted =
        formatRut(cleaned);

      setInternalValue(formatted);

      onChange?.({
        target: {
          name,
          value: formatted,
        },
        currentTarget: {
          name,
          value: formatted,
        },
      } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div className="w-full">

        <input
          {...props}
          ref={ref}
          name={name}
          type="text"
          value={internalValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          onFocus={() =>
            setIsFocused(true)
          }
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          className={`
            transition-all
            duration-200
            bg-white

            ${
              valid
                ? "border-slate-300 focus:border-[#1C4880] focus:ring-2 focus:ring-[#5DB8DB]/30"
                : "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
            }

            ${
              isFocused
                ? "ring-2 ring-[#5DB8DB]/20"
                : ""
            }

            ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : ""
            }

            ${className}
          `}
        />

        {!valid &&
          internalValue.length > 1 && (
            <div className="mt-2 ml-1 text-xs text-red-500">
              RUT inválido
            </div>
          )}
      </div>
    );
  }
);

RutInput.displayName = "RutInput";

export default RutInput;