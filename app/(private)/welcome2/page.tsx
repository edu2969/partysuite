"use client";

import Welcome2 from "@/components/Welcome2";
import SoundPlayerProvider from "@/components/context/SoundPlayerContext";

export default function WelcomePage() {
    return (
        <SoundPlayerProvider>
            <Welcome2 />
        </SoundPlayerProvider>
    );
}