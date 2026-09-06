"use client"

import SoundPlayerProvider from "@/components/context/SoundPlayerContext";
import Welcome from "@/components/Welcome";

export default function WelcomePage() {
    return (<SoundPlayerProvider>
        <Welcome />
    </SoundPlayerProvider>);
}