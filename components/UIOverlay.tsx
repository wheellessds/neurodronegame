
import React, { useState, useEffect } from 'react';
import { NeuroFace } from './NeuroFace';
import { Persona } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface UIOverlayProps {
    stats: { hp: number; fuel: number; cargoHp: number; money: number; distance: number; distToNext: number };
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
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ stats, gameTime, faceStatus, persona, vedalMessage, isMobile, urgentOrderProgress, onAvatarClick, isFullscreen: isFullscreenProp, isAdmin, userName, nameError }) => {
    // Falls back to checking document if prop not provided (for safety)
    const isFullscreen = isFullscreenProp ?? !!document.fullscreenElement;

    const parts = vedalMessage.split('||');
    const displayMsg = parts.length > 1 ? parts[1] : parts[0];

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    return (
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between z-40 overflow-hidden font-vt323">
            {!isFullscreen && (
                <div className="absolute top-24 right-4 pointer-events-auto flex items-center gap-1 group">
                    <button
                        onClick={toggleFullscreen}
                        className="bg-slate-800/80 border border-slate-500 text-white/70 hover:text-white p-2 rounded-lg backdrop-blur-sm flex items-center gap-2 active:scale-95 transition-all text-xs"
                    >
                        <span className="leading-none">⛶</span>
                        <span>FULLSCREEN</span>
                    </button>
                    <div className="opacity-60 hover:opacity-100 transition-opacity">
                        <InfoTooltip text="將遊戲畫面切換至全螢幕模式，提升沉浸感。" position="left" />
                    </div>
                </div>
            )}

            <div className={`flex flex-col w-full ${isMobile ? 'gap-1' : 'gap-4'}`}>
                {urgentOrderProgress && (
                    <div className={`w-full max-w-2xl mx-auto bg-slate-900 border-2 border-purple-500 rounded-full relative overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.5)] ${isMobile ? 'h-6' : 'h-8 mb-2'}`}>
                        <div className="h-full bg-purple-600 transition-all duration-75" style={{ width: `${urgentOrderProgress.percent * 100}%` }} />
                        <div className={`absolute inset-0 flex items-center justify-center font-bold text-white tracking-widest text-shadow ${isMobile ? 'text-xs' : ''}`}>
                            RUSH: {Math.ceil(urgentOrderProgress.timeLeft)}s
                        </div>
                    </div>
                )}

                <div className={`flex justify-between items-start w-full ${isMobile ? 'flex-wrap' : ''}`}>
                    <div className="flex gap-2 items-start">
                        <div
                            className={`pointer-events-auto cursor-pointer hover:scale-110 transition-transform active:scale-95 group relative ${isMobile ? 'scale-75 origin-top-left -mr-4' : ''}`}
                            onClick={onAvatarClick}
                            title="Click for Settings / Pause (點擊進入設置/暫停)"
                        >
                            <NeuroFace status={faceStatus} persona={persona} />
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                        </div>

                        <div className="flex flex-col gap-1">
                            <div className="flex gap-1 flex-wrap">
                                <div className="bg-slate-800/80 border border-cyan-500 px-2 py-0.5 rounded backdrop-blur-sm shadow-[0_0_5px_rgba(6,182,212,0.3)]">
                                    <span className="text-cyan-400 font-bold text-sm">DIST: {stats.distance}m</span>
                                </div>
                                <div className="bg-slate-800/80 border border-pink-500 px-2 py-0.5 rounded backdrop-blur-sm">
                                    <span className="text-pink-400 font-bold text-sm">TIME: {formatTime(gameTime)}</span>
                                </div>
                                {!isMobile && (
                                    <div className="bg-slate-800/80 border border-green-500 px-2 py-0.5 rounded backdrop-blur-sm">
                                        <span className="text-green-400 font-bold text-sm">NEXT: {stats.distToNext}m</span>
                                    </div>
                                )}
                            </div>

                            <div className={`bg-slate-800/80 border border-slate-500 p-1.5 rounded backdrop-blur-sm transition-all ${isMobile ? 'max-w-[200px]' : 'max-w-lg'}`}>
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-green-400 font-bold block text-[8px] leading-none">VEDAL</span>
                                    {userName && (
                                        <span className="text-[10px] text-cyan-400/70 font-mono flex items-center gap-1">
                                            {isAdmin && <span title="管理員權限" className="text-yellow-400">🛡️</span>}
                                            {userName}
                                        </span>
                                    )}
                                </div>
                                <p className={`${isMobile ? 'text-[11px]' : 'text-lg'} text-white leading-tight font-bold`}>{displayMsg}</p>
                                {nameError && (
                                    <p className="text-red-500 text-[10px] mt-1 font-bold animate-pulse">⚠️ {nameError}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {isMobile && (
                            <div className="flex flex-col gap-1 w-24 mt-12">
                                <CompactBar label="FUEL" val={stats.fuel} color="bg-blue-500" />
                                <CompactBar label="HULL" val={stats.hp} color="bg-red-500" />
                                <CompactBar label="RUM" val={stats.cargoHp} color="bg-orange-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!isMobile && (
                <div className="flex flex-col gap-2 w-64 transition-all">
                    <StandardBar label="FUEL" val={stats.fuel} color="bg-blue-500" textColor="text-blue-300" />
                    <StandardBar label="HULL" val={stats.hp} color="bg-red-500" textColor="text-red-300" />
                    <StandardBar label="RUM" val={stats.cargoHp} color="bg-orange-500" textColor="text-orange-300" />
                </div>
            )}
        </div>
    );
};

const CompactBar: React.FC<{ label: string; val: number; color: string }> = ({ label, val, color }) => (
    <div className="flex flex-col w-full text-shadow">
        <div className="flex justify-between text-[8px] text-white/70 font-bold leading-none mb-0.5 px-0.5">
            <span>{label}</span>
            <span>{Math.floor(val)}%</span>
        </div>
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-white/10">
            <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${Math.max(0, val)}%` }} />
        </div>
    </div>
);

const StandardBar: React.FC<{ label: string; val: number; color: string; textColor: string }> = ({ label, val, color, textColor }) => (
    <div className="bg-slate-800/80 p-2 rounded border border-slate-600 backdrop-blur-md shadow-lg">
        <div className={`flex justify-between text-[10px] ${textColor} mb-1 font-bold`}>
            <span>{label}</span>
            <span>{Math.floor(val)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden border border-slate-900">
            <div className={`h-full ${color} transition-all duration-200`} style={{ width: `${Math.max(0, val)}%` }} />
        </div>
    </div>
);
