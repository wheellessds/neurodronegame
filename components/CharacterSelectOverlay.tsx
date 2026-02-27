import React, { useState, useRef, useEffect } from 'react';
import { Persona } from '../types';
import { DroneView } from './DroneView';

// Import Personas
import neuroPortrait from '../assets/conceptart/neuro.png';
import evilPortrait from '../assets/conceptart/evil.png';
import vedalPortrait from '../assets/conceptart/Vedal.webp';
import airisPortrait from '../assets/conceptart/Airis.webp';

interface Character {
    id: Persona;
    name: string;
    fullName: string;
    description: string;
    image: string;
    color: string;
}

const CHARACTERS: Character[] = [
    {
        id: Persona.NEURO,
        name: "Neuro-sama",
        fullName: "結城 希依 (Neuro-sama)",
        description: "以標準模式開始任務。\n此角色具有隨機的系統延遲模擬，\n模擬 AI 的反應遲緩。適合一般難度。",
        image: neuroPortrait,
        color: "#f472b6" // pink-400 (matching debris)
    },
    {
        id: Persona.EVIL,
        name: "Evil Neuro",
        fullName: "結城 希依 (Evil Neuro)",
        description: "以高速模式開始任務。\n機體數值極大化，適合尋求極限速度感的玩家。",
        image: evilPortrait,
        color: "#ef4444" // red-500
    },
    {
        id: Persona.VEDAL,
        name: "Vedal",
        fullName: "Vedal (Creator)",
        description: "以穩定高效模式開始任務。\n身為 Neuro 的創造者，具有極高的硬體耐性與能源效率，\n能承受劇烈撞擊且更省油，適合新手或長距離任務。",
        image: vedalPortrait,
        color: "#16a34a" // green-600 (more distinct)
    },
    {
        id: Persona.AIRIS,
        name: "Airis",
        fullName: "Airis",
        description: "以最平庸的數值開始任務。\n[被動] 節奏回饋 (Rhythm Feedback)\n受傷時會生成回復圓圈，收集後可修復機體與貨物。\n適合而在險境中尋找節奏的玩家。",
        image: airisPortrait,
        color: "#94a3b8" // slate-400
    }
];


interface CharacterSelectOverlayProps {
    onSelect: (p: Persona) => void;
    onClose: () => void;
    isMobile?: boolean;
}

export const CharacterSelectOverlay: React.FC<CharacterSelectOverlayProps> = ({ onSelect, onClose, isMobile }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isBurstingPreview, setIsBurstingPreview] = useState(false);
    const [showSonicBoom, setShowSonicBoom] = useState(false);
    const [isEntering, setIsEntering] = useState(false);

    // Staggered animation states
    const [showBackground, setShowBackground] = useState(false);
    const [showHeader, setShowHeader] = useState(false);
    const [showContent, setShowContent] = useState(false);
    const [showFooter, setShowFooter] = useState(false);

    // Left text elements staggered animation states
    const [showPilotLabel, setShowPilotLabel] = useState(false);
    const [showCharacterName, setShowCharacterName] = useState(false);
    const [showDescription, setShowDescription] = useState(false);
    const [showStartButton, setShowStartButton] = useState(false);

    useEffect(() => {
        // Trigger enter animation after component mounts
        const timer = setTimeout(() => setIsEntering(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // Staggered entrance animations
    useEffect(() => {
        if (!isEntering) return;

        const timer1 = setTimeout(() => setShowBackground(true), 200);
        const timer2 = setTimeout(() => setShowHeader(true), 400);
        const timer3 = setTimeout(() => setShowContent(true), 600);
        const timer4 = setTimeout(() => setShowFooter(true), 800);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [isEntering]);

    // Left text elements staggered animation
    useEffect(() => {
        if (!showContent) return;

        const timer1 = setTimeout(() => setShowPilotLabel(true), 200);
        const timer2 = setTimeout(() => setShowCharacterName(true), 400);
        const timer3 = setTimeout(() => setShowDescription(true), 600);
        const timer4 = setTimeout(() => setShowStartButton(true), 800);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            clearTimeout(timer4);
        };
    }, [showContent]);

    const nextChar = () => {
        setSelectedIndex((prev) => (prev + 1) % CHARACTERS.length);
        setIsBurstingPreview(false);
    };
    const prevChar = () => {
        setSelectedIndex((prev) => (prev - 1 + CHARACTERS.length) % CHARACTERS.length);
        setIsBurstingPreview(false);
    };

    const handleAnimationIteration = (e: React.AnimationEvent) => {
        // Prevent events bubbling from child animations (rotors, thrust)
        if (e.animationName !== 'hero-fly') return;

        const nextBursting = !isBurstingPreview;
        setIsBurstingPreview(nextBursting);
        if (nextBursting) {
            setShowSonicBoom(true);
            setTimeout(() => setShowSonicBoom(false), 800);
        }
    };

    const currentChar = CHARACTERS[selectedIndex];
    const dragStart = useRef<number | null>(null);

    const handleStart = (clientX: number) => {
        dragStart.current = clientX;
    };

    const handleEnd = (clientX: number) => {
        if (dragStart.current === null) return;
        const deltaX = dragStart.current - clientX;

        if (deltaX > 50) {
            nextChar();
        } else if (deltaX < -50) {
            prevChar();
        }
        dragStart.current = null;
    };

    const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
    const onTouchEnd = (e: React.TouchEvent) => handleEnd(e.changedTouches[0].clientX);

    const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
    const onMouseUp = (e: React.MouseEvent) => handleEnd(e.clientX);
    const onMouseLeave = () => { dragStart.current = null; };

    return (
        <div
            className={`fixed inset-0 z-[1100] bg-slate-950 flex overflow-hidden font-sans select-none cursor-grab active:cursor-grabbing transition-all duration-1000 ease-out ${isEntering ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
        >
            {/* Global Background Tech Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none transition-all duration-1000"
                style={{
                    backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    filter: isBurstingPreview ? 'blur(1px) contrast(1.5)' : 'none'
                }}
            />

            {/* Speed Warp Tunnel Background (Extreme Sync) */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-[1000ms] ${isBurstingPreview ? 'opacity-30' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_80%)]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] rotate-45 animate-warp-bg"
                    style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.15) 30px, rgba(255,255,255,0.15) 33px)' }}
                />
            </div>

            {/* Low-Speed Ambient Scan (Standard Mode Only) */}
            <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${!isBurstingPreview ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-x-0 h-px bg-cyan-500/10 animate-global-scan" />
            </div>

            {/* --- BACKGROUND LAYER: PORTRAITS (CAROUSEL SYSTEM) --- */}
            <div className={`absolute inset-0 pointer-events-none z-10 overflow-hidden flex items-end justify-center lg:justify-end transition-all duration-1000 ease-out ${showBackground ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}>
                {CHARACTERS.map((char, index) => {
                    const offset = index - selectedIndex;
                    const isActive = index === selectedIndex;

                    return (
                        <div
                            key={char.id}
                            className={`absolute inset-0 flex items-end justify-center lg:justify-end pointer-events-none transition-all duration-[1200ms] ${isMobile ? 'translate-x-[20%] pb-[10vh]' : ''}`}
                            style={{
                                transform: isMobile
                                    ? `translateX(${(offset * 70) + 20}vw) scale(${isActive ? 1 : 0.6}) translateZ(0)`
                                    : `translateX(${offset * 40}vw) scale(${isActive ? 1 : 0.7}) translateZ(0)`,
                                opacity: isActive ? 1 : 0.2,
                                zIndex: isActive ? 20 : 10,
                                filter: isActive ? 'drop-shadow(0 0 80px rgba(0,0,0,0.8))' : 'grayscale(60%) blur(6px)',
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                        >
                            {/* Ambient Glow behind character */}
                            <div
                                className={`absolute bottom-0 right-0 w-[100%] h-[100%] blur-[180px] rounded-full translate-x-1/3 translate-y-1/3 transition-opacity duration-1000 ${isActive ? 'opacity-[0.12]' : 'opacity-0'}`}
                                style={{ backgroundColor: char.color }}
                            />

                            <div className={`${isActive ? 'animate-portrait' : ''} h-full flex items-end`}>
                                <img
                                    src={char.image}
                                    alt={char.name}
                                    className="h-[75vh] md:h-[95vh] lg:h-[115vh] w-auto max-w-none object-contain filter transition-all duration-1000"
                                    style={{
                                        transform: char.id === Persona.AIRIS ? 'scale(2.1) translateY(60%) translateX(-32%)' : 'none',
                                        transformOrigin: 'bottom center'
                                    }}
                                />
                            </div>

                            {/* Grounding Fade - Ensuring seamless integration with floor */}
                            <div className={`absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent z-20 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
                        </div>
                    );
                })}
            </div>

            {/* --- UI LAYER: CONTENT --- */}
            <div className={`relative z-30 w-full h-full flex flex-col ${isMobile ? 'px-6 pt-6 pb-2 justify-between' : 'p-6 md:p-12 lg:p-16'}`}>
                {/* Mobile Text Mask - Ensures readability over art */}
                <div className={`absolute inset-y-0 left-0 w-full lg:w-1/2 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent pointer-events-none z-[-1] transition-opacity duration-1000 ${isMobile ? 'opacity-100' : 'opacity-0'}`} />

                {/* Navigation Header */}
                <div className={`flex items-center justify-between ${isMobile ? 'mt-2 h-12' : 'mb-4 lg:mb-8'} transition-all duration-700 ease-out ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
                    }`}>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-2 font-black italic tracking-tighter text-sm md:text-base border-b border-transparent hover:border-cyan-400/50 pb-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                        EXIT / 退出
                    </button>

                    <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-800 shadow-2xl">
                        <button onClick={prevChar} className="text-slate-400 hover:text-white transition-colors active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} /></svg></button>
                        <div className="text-slate-500 font-mono text-xs w-10 text-center select-none"><span className="text-white font-bold">{selectedIndex + 1}</span> / {CHARACTERS.length}</div>
                        <button onClick={nextChar} className="text-slate-400 hover:text-white transition-colors active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} /></svg></button>
                    </div>
                </div>

                {/* Main Body - Compact Info */}
                <div className={`flex-1 flex flex-col ${isMobile ? 'pt-4 pb-0 max-w-full' : 'justify-center max-w-2xl'} transition-all duration-700 ease-out ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                    }`}>
                    {/* Header/Drone Group */}
                    <div className={isMobile ? 'flex flex-col' : ''}>
                        <div className={isMobile ? 'mb-4' : 'mb-6'}>
                            <span className={`text-cyan-500 block text-[10px] md:text-sm font-mono tracking-[0.3em] opacity-80 mb-1 transition-all duration-500 ease-out ${showPilotLabel ? 'translate-x-0 opacity-80' : '-translate-x-4 opacity-0'
                                }`}>UNITS // PILOT-01</span>
                            <h2 className={`${isMobile ? 'text-4xl' : 'text-4xl md:text-5xl lg:text-7xl'} font-black text-white italic tracking-tighter leading-none uppercase transition-all duration-500 ease-out ${showCharacterName ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                                }`}>
                                {currentChar.name}
                            </h2>
                            <div className={`${isMobile ? 'h-0.5 w-16' : 'h-1 lg:h-1.5 w-24'} mt-4 transition-all duration-500 ${showCharacterName ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                                }`} style={{ backgroundColor: currentChar.color, boxShadow: `0 0 25px ${currentChar.color}`, transformOrigin: 'left' }} />
                        </div>

                        {/* Drone Showcase */}
                        <div
                            className={`${isMobile ? 'my-2' : 'mb-8'} relative flex items-center justify-center transition-all duration-700`}
                            onAnimationIteration={handleAnimationIteration}
                            style={{
                                filter: isBurstingPreview
                                    ? 'brightness(1.2) saturate(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.2))'
                                    : 'drop-shadow(0 0 10px rgba(34,211,238,0.1))',
                                transform: isBurstingPreview ? 'scale(1.2)' : 'scale(1)',
                            }}
                        >
                            {/* Rhythmic Glow Layer - Subtle tech pulse */}
                            <div className={`absolute inset-0 rounded-full blur-[40px] pointer-events-none transition-all duration-1000
                                ${isBurstingPreview ? 'bg-white/10 animate-burst-jitter' : 'bg-cyan-400/5 animate-standard-pulse'}`} />

                            {/* Sonic Ring (CSS only) */}
                            {showSonicBoom && (
                                <div className="absolute w-64 h-64 border-8 border-white rounded-full animate-sonic-boom-preview z-0" />
                            )}

                            {/* Standard Mode Scanning Pulse - Simplified */}
                            {!isBurstingPreview && (
                                <div className="absolute w-[150%] h-[1px] bg-cyan-400/20 blur-[1px] animate-scan-line-slow z-0" />
                            )}

                            <DroneView
                                color={currentChar.color}
                                persona={currentChar.id}
                                isMobile={isMobile}
                                showSpeedLines={true}
                                showGlow={true}
                                thrustPower={1}
                                className="animate-fly"
                                isBursting={isBurstingPreview}
                            />

                            {/* Status Overlay Tag - Compact & Semi-transparent */}
                            <div className={`absolute -top-10 -right-6 backdrop-blur-md border px-3 py-1 rounded-md text-[11px] font-black tracking-[0.2em] transition-all duration-700 uppercase z-50
                                ${isBurstingPreview ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'bg-slate-900/40 text-slate-600 border-slate-800'}`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isBurstingPreview ? 'bg-cyan-400 animate-ping' : 'bg-slate-700'}`} />
                                    <span>
                                        {isBurstingPreview ? 'ENGINE: BURST' : 'ENGINE: STBY'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Group (Description + Button) - Pinned to bottom on mobile */}
                    <div className={`${isMobile ? 'mt-auto flex flex-col gap-6' : ''}`}>
                        {/* Specs Card */}
                        <div className={`${isMobile ? 'w-3/5 pl-4' : 'mb-8 pl-8'} border-l-4 py-3 bg-slate-900/60 backdrop-blur-md rounded-r-2xl transition-all duration-500 ease-out ${showDescription ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                            }`} style={{ borderColor: currentChar.color }}>
                            <h3 className="text-[10px] font-bold text-slate-500 mb-2 tracking-[0.2em] uppercase">Characteristics</h3>
                            <p className={`text-slate-200 ${isMobile ? 'text-sm leading-relaxed' : 'text-sm md:text-lg leading-relaxed'} font-medium italic`}>
                                {currentChar.description}
                            </p>
                        </div>

                        {/* Action Button */}
                        <div className={`${isMobile ? 'pb-2' : ''} transition-all duration-500 ease-out ${showStartButton ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                            }`}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(currentChar.id);
                                }}
                                className={`group relative w-full lg:w-fit ${isMobile ? 'px-8 py-5 text-2xl' : 'px-16 py-5 text-2xl'} bg-white text-slate-950 font-black italic skew-x-[-12deg] transition-all hover:bg-cyan-400 hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(255,255,255,0.05)]`}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-4">
                                    START / 出擊
                                    <svg className={isMobile ? 'w-6 h-6' : 'w-7 h-7'} fill="currentColor" viewBox="0 0 20 20"><path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" /></svg>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer Subtle Detail */}
                <div className={`${isMobile ? 'mt-2' : 'mt-8'} flex justify-between items-end opacity-20 font-mono text-[10px] tracking-widest uppercase select-none transition-all duration-700 ease-out ${showFooter ? 'translate-y-0 opacity-20' : 'translate-y-4 opacity-0'
                    }`}>
                    <div>V2.0 ALPHA // SYSTEM_ACTIVE</div>
                    <div className="hidden md:block text-right">Coordinate sync complete. waiting for pilot...</div>
                </div>
            </div>

            {/* Global Overlay Pattern */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] opacity-20 z-30" />

            <style>{`
                @keyframes portrait-move {
                    0%, 100% { transform: translateY(0) scale(1.05); }
                    50% { transform: translateY(-15px) scale(1.08); }
                }
                .animate-portrait {
                    animation: portrait-move 6s ease-in-out infinite;
                }
                @keyframes sonic-boom-pre-css {
                    0% { transform: scale(0.2); opacity: 1; border-width: 20px; }
                    100% { transform: scale(8); opacity: 0; border-width: 0px; }
                }
                .animate-sonic-boom-preview {
                    animation: sonic-boom-pre-css 0.8s cubic-bezier(0.05, 0.8, 1, 0.1) forwards;
                }
                @keyframes scan-line-slow {
                    0% { transform: translateY(-40px); opacity: 0; }
                    50% { opacity: 0.4; }
                    100% { transform: translateY(40px); opacity: 0; }
                }
                .animate-scan-line-slow {
                    animation: scan-line-slow 4s ease-in-out infinite;
                }
                @keyframes global-scan {
                    0% { top: 0; opacity: 0; }
                    10%, 90% { opacity: 0.1; }
                    50% { top: 100%; opacity: 0.2; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-global-scan {
                    animation: global-scan 10s linear infinite;
                }
                @keyframes warp-bg {
                    0% { transform: translate(-3%, -3%) rotate(45deg); }
                    100% { transform: translate(3%, 3%) rotate(45deg); }
                }
                .animate-warp-bg {
                    animation: warp-bg 0.08s linear infinite;
                }
                @keyframes standard-pulse {
                    0%, 100% { opacity: 0.1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(1.15); }
                }
                .animate-standard-pulse {
                    animation: standard-pulse 4s ease-in-out infinite;
                }
                @keyframes burst-jitter {
                    0%, 100% { opacity: 0.7; transform: scale(1.1) translate(0,0); }
                    15% { opacity: 1; transform: scale(1.3) translate(-3px, 3px); }
                    30% { opacity: 0.8; transform: scale(1.2) translate(3px, -3px); }
                    50% { opacity: 1; transform: scale(1.4) translate(-2px, -2px); }
                    75% { opacity: 0.8; transform: scale(1.15) translate(2px, 2px); }
                }
                .animate-burst-jitter {
                    animation: burst-jitter 0.12s linear infinite;
                }
            `}</style>
        </div >
    );
};
