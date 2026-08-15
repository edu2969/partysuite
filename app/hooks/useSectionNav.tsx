"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const DEFAULT_OFFSET = 120;
const MAX_ATTEMPTS = 30;

export function useSectionNav(offset: number = DEFAULT_OFFSET) {
    const router = useRouter();
    const pathname = usePathname();
    const pendingScrollId = useRef<string | null>(null);

    const performScroll = (id: string) => {
        const element = document.getElementById(id);
        if (!element) return false;
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
            top: elementPosition - offset,
            behavior: "smooth",
        });
        return true;
    };

    const goToInicio = () => {
        if (pathname === "/") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            router.push("/");
        }
    };

    const scrollToSection = (id: string) => {
        if (pathname !== "/") {
            pendingScrollId.current = id;
            router.push("/");
            return;
        }
        performScroll(id);
    };

    // Reintenta el scroll tras navegar a "/" desde otra página,
    // hasta que el elemento exista en el nuevo DOM.
    useEffect(() => {
        if (pathname !== "/" || !pendingScrollId.current) return;

        const id = pendingScrollId.current;
        let attempts = 0;

        const tryScroll = () => {
            attempts++;
            const done = performScroll(id);
            if (done || attempts >= MAX_ATTEMPTS) {
                pendingScrollId.current = null;
                return;
            }
            requestAnimationFrame(tryScroll);
        };

        requestAnimationFrame(tryScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return { goToInicio, scrollToSection };
}