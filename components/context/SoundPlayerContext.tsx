import React, { createContext, useContext, useRef } from "react";

type SoundPlayerContextType = {
    play: (src: string) => void;
};

const SoundPlayerContext = createContext<SoundPlayerContextType | undefined>(undefined);

export const useSoundPlayer = () => {
    const ctx = useContext(SoundPlayerContext);
    if (!ctx) throw new Error("useSoundPlayer must be used within SoundPlayerProvider");
    return ctx;
};

export default function SoundPlayerProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const play = (src: string) => {
        if (!src) return;
        if (!audioRef.current) {
            audioRef.current = new Audio(src);
        } else {
            audioRef.current.src = src;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
    };

    return (
        <SoundPlayerContext.Provider value={{ play }}>
            {children}
        </SoundPlayerContext.Provider>
    );
};