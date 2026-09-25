"use client";

import { launchConfetti } from "@/app/utils/confeti";

export default function About({
    isNeo
}: {
    isNeo: boolean;
}) {
    return (<div className="w-screen h-screen">
        <div className="rainbow scale-200"></div>
        <div className="h-screen flex justify-center items-center animate-entrance">
            <div className="ml-6 scale-50 md:scale-100">
                <div className="flex">
                    <p className="text-8xl text-gray-500 mb-6 rainbow-text">PartySuite</p>
                    <span className="text-lg ml-7 text-gray-300 mt-14">v2.1</span>
                </div>
                <div className="ml-2 opacity-50 text-right">
                    <span>Powered By</span>
                    <img className="grayscale float-right ml-4" src="/yga-logo.png" width={111} alt="yGa - Icon" />
                    <div className="text-lg">
                        <p className="text-md uppercase">Contáctenos vía e-mail a <a className="text-blue-400" href="mailto:contacto@yga.cl">contacto@yga.cl</a></p>
                    </div>
                </div>
            </div>
        </div>    
        {isNeo && (<div className="fixed bottom-8 right-6 cursor-pointer text-xl ml-2 border-2 border-transparent hover:border-white/20 px-3 rounded-md" style={{ transform: "rotate(-45deg)" }} onClick={async () => {
            const resp = await fetch("/api/regenerator?action=checktimes")
            if(resp.ok) {
                launchConfetti({
                    count: 180,
                    duration: 2600,
                    spread: 240,
                });
            }
        }}>
            🪰 Chk
        </div>)}  
        {isNeo && (<div className="fixed bottom-8 right-32 cursor-crosshair text-xl ml-2 border-2 border-transparent hover:border-white/20 px-3 rounded-md" style={{ transform: "rotate(-45deg)" }} onClick={async () => {            
            const resp = await fetch("/api/regenerator?action=bilistas")
            if(resp.ok) {
                launchConfetti({
                    count: 180,
                    duration: 2600,
                    spread: 240,
                });
            }
        }}>
            ⚡BI
        </div>)}
    </div>);
}