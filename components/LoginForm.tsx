"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import Image from "next/image";
import { FiLoader } from "react-icons/fi";

interface LoginFormProps {
  email: string;
  password: string;
}

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm<LoginFormProps>();

  const [error, setError] = useState<string | boolean>(false);

  const onSubmit = async (data: LoginFormProps) => {
    setLoading(true);
    setError(false);

    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        setError("Credenciales inválidas");
        return;
      }

      const session = await getSession();
      if(session) {
        const userRole = session.user?.role;
        if (userRole === "ADMINISTRADOR" || userRole === "NEO") {
          router.push("/events");
        } else if (userRole === "PORTERIA") {
          router.push("/welcome");
        } else if (userRole === "EMBAJADOR") {
          router.push("/events");
        } else {
          setError("Rol de usuario desconocido");
        }
      }
    } catch (error) {
      console.log(error);
      setError("Ocurrió un error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 sm:px-6">

      {/* Fondo */}
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

      {/* Contenedor del login */}
      <div className="relative z-10 w-full max-w-md">

        {/* Tarjeta */}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 shadow-2xl backdrop-blur-md sm:p-8">

          {/* Logo */}
          <div className="flex flex-col items-center">

            <Image
              src="/logo.png"
              alt="Actionium-Brand"
              width={160}
              height={160}
              priority
              className="h-auto w-32 sm:w-36"
            />

            <div className="mt-4 text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-gray-200">
                PartySuite
                <span className="ml-2 align-middle text-xs font-normal text-gray-400">
                  v0.7
                </span>
              </h1>

              <p className="mt-2 text-sm text-gray-400">
                Gestión de eventos y acceso
              </p>
            </div>
          </div>

          {/* Formulario */}
          <form
            className="mt-8 space-y-5"
            onSubmit={handleSubmit(onSubmit)}
          >

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-blue-200"
              >
                DIRECCIÓN EMAIL
              </label>

              <div className="mt-2">
                <input
                  {...register("email", {
                    required: "e-mail requerido",
                  })}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  className="block w-full rounded-lg border border-white/10 bg-white/95 px-3 py-2.5 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />

                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-blue-200"
                >
                  CONTRASEÑA
                </label>
              </div>

              <div className="mt-2">
                <input
                  {...register("password", {
                    required: "contraseña requerida",
                  })}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-white/10 bg-white/95 px-3 py-2.5 text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                />

                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Error login */}
            {error && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              className="flex w-full justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-xl font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            >{loading ? <>
                <FiLoader className="w-5 h-5 mt-1 mr-3 animate-spin" /> Validando
              </> : 'Entrar'}              
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              PartySuite · Plataforma de gestión de eventos
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}