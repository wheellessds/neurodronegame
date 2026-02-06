import React, { useState, useEffect } from 'react';
import { EquipmentId, Persona } from '../types';
import { NeuroFace } from './NeuroFace';
import { InfoTooltip } from './InfoTooltip';

interface HUDOverlayProps {
    hp: number;
    maxHp: number;
    fuel: number;
    maxFuel: number;
    cargoHp: number;
    maxCargoHp: number;
    speed: number;
    distance: number;
    distToNext: number;
    money: number;
    equippedItem: EquipmentId;
    isInvincible?: boolean;
    isGodMode?: boolean;

    // Narrative & Interaction Props (from UIOverlay)
    gameTime: number;
    faceStatus: 'idle' | 'panic' | 'dead' | 'win' | 'fast';
    persona: Persona;
    vedalMessage: string;
    isMobile?: boolean;
    urgentOrderProgress: { percent: number, timeLeft: number } | null;
    onAvatarClick?: () => void;
    isFullscreen?: boolean;
    isAdmin?: boolean;
    userName?: string;
    nameError?: string | null;

    show?: boolean;
    isBursting?: boolean; // For high-speed UI glitch effects
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({
    hp, maxHp, fuel, maxFuel, cargoHp, maxCargoHp, speed, distance, distToNext, money, equippedItem, isInvincible, isGodMode,
    gameTime, faceStatus, persona, vedalMessage, isMobile, urgentOrderProgress, onAvatarClick, isFullscreen: isFullscreenProp, isAdmin, userName, nameError,
    show = true,
    isBursting = false
}) => {
    // Track how long we've been in high-speed mode
    const [burstDuration, setBurstDuration] = useState(0);
    const isHudShrunk = burstDuration >= 1; // Shrink after 1 second

    // Animation states for staggered entrance
    const [showTopLeft, setShowTopLeft] = useState(false);
    const [showTopRight, setShowTopRight] = useState(false);
    const [showBottom, setShowBottom] = useState(false);

    // Animation states for left text elements
    const [showMessage, setShowMessage] = useState(false);
    const [showEquipment, setShowEquipment] = useState(false);
    const [showUrgentOrder, setShowUrgentOrder] = useState(false);

    useEffect(() => {
        if (!isBursting) {
            setBurstDuration(0);
            return;
        }
        const interval = setInterval(() => {
            setBurstDuration(prev => prev + 0.1);
        }, 100);
        return () => clearInterval(interval);
    }, [isBursting]);

    // Staggered entrance animation
    useEffect(() => {
        if (!show) return;

        const timer1 = setTimeout(() => setShowTopLeft(true), 100);
        const timer2 = setTimeout(() => setShowTopRight(true), 300);
        const timer3 = setTimeout(() => setShowBottom(true), 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [show]);

    // Left text elements staggered animation
    useEffect(() => {
        if (!showTopLeft) return;

        const timer1 = setTimeout(() => setShowMessage(true), 200);
        const timer2 = setTimeout(() => setShowEquipment(true), 400);
        const timer3 = setTimeout(() => setShowUrgentOrder(true), 600);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [showTopLeft]);

    if (!show) return null;

    // Falls back to checking document if prop not provided
    const isFullscreen = isFullscreenProp ?? (typeof document !== 'undefined' ? !!document.fullscreenElement : false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            document.exitFullscreen();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate percentages
    const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const fuelPercent = Math.max(0, Math.min(100, (fuel / maxFuel) * 100));
    const cargoPercent = Math.max(0, Math.min(100, (cargoHp / maxCargoHp) * 100));

    // Determine colors
    const hpColor = hpPercent > 60 ? 'bg-green-500' : hpPercent > 30 ? 'bg-yellow-500' : 'bg-red-600';
    const fuelColor = fuelPercent > 50 ? 'bg-cyan-500' : 'bg-orange-500';
    const cargoColor = cargoPercent > 50 ? 'bg-amber-500' : 'bg-red-500';

    const parts = vedalMessage.split('||');
    const displayMsg = parts.length > 1 ? parts[1] : parts[0];

    return (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 font-sans select-none overflow-hidden">

            {/* --- TOP LEFT: AVATAR & STATUS BARS --- */}
            <div className={`flex flex-col gap-2 w-full md:w-auto items-start pointer-events-none transition-all duration-700 ease-out origin-top-left
                ${isBursting ? 'skew-x-[-15deg] translate-x-1 animate-pulse' : ''}
                ${isHudShrunk ? 'scale-75 opacity-70' : ''}
                ${showTopLeft ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>

                {/* Fullscreen Toggle (Desktop Only) */}
                {!isMobile && !isFullscreen && (
                    <div className="pointer-events-auto flex items-center gap-2 mb-2 group">
                        <button onClick={toggleFullscreen} className="bg-slate-900/80 border border-slate-500/50 text-cyan-400 hover:text-white px-3 py-1 text-xs font-bold tracking-widest backdrop-blur-sm skew-x-[-12deg] transition-all hover:scale-105 active:scale-95">
                            <span className="skew-x-[12deg]">FULLSCREEN [F11]</span>
                        </button>
                    </div>
                )}

                <div className="flex gap-4 items-start w-full md:w-[500px]">
                    {/* Neuro Avatar */}
                    <div
                        className="relative pointer-events-auto cursor-pointer group shrink-0"
                        onClick={onAvatarClick}
                    >
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900/50 rounded-full border-2 border-cyan-500/50 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-transform group-hover:scale-105 active:scale-95">
                            <div className="scale-125 origin-center">
                                <NeuroFace status={faceStatus} persona={persona} />
                            </div>
                        </div>
                        {isInvincible && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[8px] font-black px-1 rounded animate-pulse">SHIELD</div>}
                        <div className="absolute inset-0 rounded-full border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Bars Container */}
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 skew-x-[-6deg] origin-top-left pt-1">

                        {/* Vedal Message Bubble */}
                        <div className={`bg-slate-900/80 border-l-2 border-cyan-500 p-2 backdrop-blur-md mb-1 transition-all duration-500 ease-out ${
                            showMessage ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                        }`}>
                            <div className="skew-x-[6deg]">
                                <div className="flex justify-between items-center text-[10px] text-cyan-500/70 font-bold mb-0.5 leading-none tracking-wider">
                                    <span>SYSTEM MESSAGE // VEDAL</span>
                                    {userName && (
                                        <span className="text-slate-400 font-mono flex items-center gap-1">
                                            {isAdmin && <span title="ADMIN" className="text-yellow-400">★</span>}
                                            {userName}
                                        </span>
                                    )}
                                </div>
                                <div className="text-white text-sm md:text-base font-bold leading-tight drop-shadow-sm line-clamp-2 md:line-clamp-none">
                                    {displayMsg}
                                </div>
                                {nameError && <div className="text-red-500 text-xs font-bold animate-pulse mt-1">{nameError}</div>}
                            </div>
                        </div>

                        {/* Equipment (Swapped from Bottom) */}
                        <div className={`bg-slate-900/80 p-2 border-l-4 border-purple-500/50 skew-x-[-12deg] backdrop-blur-md shadow-lg mb-1 max-w-[200px] transition-all duration-500 ease-out ${
                            showEquipment ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                        }`}>
                            <div className="skew-x-[12deg] flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center border border-white/10">
                                    {equippedItem !== 'NONE' ? (
                                        <div className="text-lg">🛠️</div>
                                    ) : (
                                        <span className="text-slate-600 text-[8px] font-bold"> - </span>
                                    )}
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] text-purple-400 font-bold tracking-wider">EQUIPPED</span>
                                    <span className="text-xs font-bold text-white uppercase">{equippedItem.replace('_', ' ')}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Urgent Order Progress Bar */}
                {urgentOrderProgress && (
                    <div className={`w-full max-w-md mt-2 ml-4 transition-all duration-500 ease-out ${
                        showUrgentOrder ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                    }`}>
                        <div className="relative h-6 bg-slate-900/90 border border-purple-500 rounded skew-x-[-12deg] overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                            <div className="absolute inset-y-0 left-0 bg-purple-600 transition-all duration-100 ease-linear" style={{ width: `${urgentOrderProgress.percent * 100}%` }}>
                                <div className="absolute inset-0 bg-white/20 animate-pulse-fast" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center skew-x-[12deg]">
                                <span className="text-white font-black italic tracking-widest text-xs drop-shadow-md animate-pulse">
                                    RUSH DELIVERY: {Math.ceil(urgentOrderProgress.timeLeft)}s
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- TOP RIGHT: SCORE & DISTANCE --- */}
            <div className={`absolute top-4 right-4 flex flex-col items-end gap-2 skew-x-[-6deg] origin-top-right transition-all duration-700 ease-out
                ${isBursting ? 'translate-x--2 skew-x-[-12deg]' : ''}
                ${isHudShrunk ? 'scale-75 opacity-70' : ''}
                ${showTopRight ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
                <div className={`bg-slate-900/80 border-b-2 border-yellow-500 px-4 py-2 backdrop-blur-md shadow-lg
                    ${isBursting ? 'animate-pulse border-yellow-300' : ''}`}>
                    <div className="skew-x-[6deg] text-right">
                        <div className="text-[8px] text-yellow-500 font-bold tracking-[0.2em] mb-0.5">CREDITS</div>
                        <div className="text-2xl md:text-3xl font-black italic text-white leading-none font-vt323 tracking-widest">
                            ${money.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1 items-end">
                    <div className="bg-slate-900/60 border-r-2 border-cyan-500 px-3 py-1 backdrop-blur-sm">
                        <div className="skew-x-[6deg] text-cyan-400 font-mono text-xs font-bold tracking-wider">
                            DIST: {Math.floor(distance)}m
                        </div>
                    </div>
                    {/* Next Checkpoint / Time */}
                    <div className="flex gap-2">
                        <div className="bg-slate-900/60 border-r-2 border-pink-500 px-3 py-1 backdrop-blur-sm">
                            <div className="skew-x-[6deg] text-pink-400 font-mono text-xs font-bold tracking-wider">
                                TIME: {formatTime(gameTime)}
                            </div>
                        </div>
                        {distToNext > 0 && (
                            <div className="bg-slate-900/60 border-r-2 border-green-500 px-3 py-1 backdrop-blur-sm">
                                <div className="skew-x-[6deg] text-green-400 font-mono text-xs font-bold tracking-wider">
                                    NEXT: {distToNext}m
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- BOTTOM BAR: EQUIPMENT & SPEEDOMETER --- */}
            <div className={`flex justify-between items-end w-full max-w-7xl mx-auto mt-auto pb-4 md:pb-8 px-4 transition-all duration-700 ease-out origin-bottom
                ${showBottom ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

                {/* Left: Status Bars (Swapped from Top) */}
                <div className={`flex flex-col gap-1 w-full max-w-[280px] skew-x-[-12deg] origin-bottom-left transition-all duration-700 ease-in-out ${isHudShrunk ? 'scale-75 opacity-70' : ''}`}>
                    {/* HP */}
                    <div className="relative h-4 bg-slate-800/80 skew-x-[-12deg] overflow-hidden border-r-2 border-slate-600/50">
                        <div className={`absolute inset-y-0 left-0 ${hpColor} transition-all duration-300`} style={{ width: `${hpPercent}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 skew-x-[12deg]">
                            <span className="text-[10px] font-black text-white/90 tracking-widest drop-shadow-md">HULL {Math.ceil(hp)}%</span>
                        </div>
                    </div>
                    {/* Fuel */}
                    <div className="relative h-3 bg-slate-800/80 skew-x-[-12deg] overflow-hidden border-r-2 border-slate-600/50">
                        <div className={`absolute inset-y-0 left-0 ${fuelColor} transition-all duration-300`} style={{ width: `${fuelPercent}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 skew-x-[12deg]">
                            <span className="text-[9px] font-black text-white/90 tracking-widest drop-shadow-md">FUEL {Math.ceil(fuel)}%</span>
                        </div>
                    </div>
                    {/* Cargo HP (Rum) */}
                    <div className="relative h-3 bg-slate-800/80 skew-x-[-12deg] overflow-hidden border-r-2 border-slate-600/50">
                        <div className={`absolute inset-y-0 left-0 ${cargoColor} transition-all duration-300`} style={{ width: `${cargoPercent}%` }} />
                        <div className="absolute inset-0 flex items-center px-2 skew-x-[12deg]">
                            <span className="text-[9px] font-black text-white/90 tracking-widest drop-shadow-md">CARGO {Math.ceil(cargoHp)}%</span>
                        </div>
                    </div>
                </div>

                {/* Center: Desktop Key Hints (Tutorial) */}
                {!isMobile && (
                    <div className="flex gap-4 items-end mx-auto pb-1 opacity-60">
                    </div>
                )}

                {/* Right: Speedometer */}
                <div className={`relative flex flex-col items-end transition-all duration-700 ease-in-out origin-bottom-right
                    ${isBursting ? 'scale-110 translate-y--2 text-cyan-300' : ''}
                    ${isHudShrunk ? 'scale-75 opacity-70' : ''}`}>
                    <div className="flex items-baseline gap-2 skew-x-[-12deg]">
                        <div className="text-right">
                            <div className="text-[8px] text-cyan-500/80 font-bold tracking-[0.3em] uppercase mb-[-4px]">Velocity</div>
                            <div className="text-5xl md:text-6xl font-black italic text-white leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                                {Math.abs(Math.round(speed * 10))}
                            </div>
                        </div>
                        <div className="text-xl text-slate-500 font-black italic mb-1">km/h</div>
                    </div>
                    {/* Speed Bar Visual */}
                    <div className="w-32 md:w-48 h-2 bg-slate-800 mt-1 skew-x-[-12deg] overflow-hidden border-b border-white/20">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-pink-500"
                            style={{
                                width: `${Math.min(100, (Math.abs(speed) / 20) * 100)}%`,
                                transition: 'width 0.1s linear'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Controls Hint or other overlays can go here if needed */}
        </div>
    );
};
