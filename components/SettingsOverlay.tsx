import React, { useState, useEffect } from 'react';
import { GameState, ControlsConfig, Persona } from '../types';
import { MultiplayerManager, RemotePlayer } from '../utils/multiplayer';
import { InfoTooltip } from './InfoTooltip';

interface SettingsOverlayProps {
    isOpen: boolean;
    gameState: GameState;
    controls: ControlsConfig;
    onUpdateControls: (newConfig: ControlsConfig) => void;
    onResume: () => void;
    onQuit: () => void;
    onDifficultyToggle: () => void;
    difficulty: string;
    onStartLayoutEdit: () => void;
    mpUpdateRate: 'low' | 'med' | 'high';
    setMpUpdateRate: (rate: 'low' | 'med' | 'high') => void;
    multiplayer?: {
        isActive: boolean;
        isHost: boolean;
        manager: MultiplayerManager | null;
        players: Map<string, RemotePlayer>;
        autoJoin?: boolean;
        onToggleAutoJoin?: () => void;
    };
    currentSeed?: string;
    onUpdateSeed?: (seed: string) => void;
    playerName?: string;
    onUpdateName?: (name: string) => void;
    roomParticipants?: { id: string, name: string }[];
    persona: Persona;
    onUpdatePersona: (p: Persona) => void;
    isMobileMode?: boolean;
    onToggleMobileMode?: () => void;
    onForceRestart?: () => void;
    initialTab?: 'general' | 'keyboard' | 'mobile' | 'room';
    isAdmin?: boolean;
    isLoggedIn?: boolean;
    nameError?: string | null;
    vedalMessage?: string;
    onLogout?: () => void;
    onRedeemCode?: (code: string) => void;
}

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
    isOpen,
    gameState,
    controls,
    onUpdateControls,
    onResume,
    onQuit,
    onDifficultyToggle,
    difficulty,
    onStartLayoutEdit,
    mpUpdateRate,
    setMpUpdateRate,
    multiplayer,
    currentSeed,
    onUpdateSeed,
    playerName,
    onUpdateName,
    roomParticipants,
    persona,
    onUpdatePersona,
    isMobileMode,
    onToggleMobileMode,
    onForceRestart,
    initialTab,
    isAdmin,
    isLoggedIn,
    nameError,
    vedalMessage,
    onLogout,
    onRedeemCode
}) => {
    const [activeTab, setActiveTab] = useState<'general' | 'keyboard' | 'mobile' | 'room'>(initialTab || 'general');
    const [bindingKey, setBindingKey] = useState<keyof ControlsConfig['keys'] | null>(null);
    const [localSeed, setLocalSeed] = useState(currentSeed || '');
    const [inviteCode, setInviteCode] = useState('');

    // Sync seed when prop changes
    useEffect(() => {
        if (currentSeed) setLocalSeed(currentSeed);
    }, [currentSeed]);

    // Sync tab when initialTab changes
    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        if (bindingKey) {
            const handleKeyDown = (e: KeyboardEvent) => {
                e.preventDefault();
                const newKeys = { ...controls.keys, [bindingKey]: e.key };
                onUpdateControls({ ...controls, keys: newKeys });
                setBindingKey(null);
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [bindingKey, controls, onUpdateControls]);

    if (!isOpen) return null;

    const mpManager = multiplayer?.manager;
    const isHost = multiplayer?.isHost;

    return (
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto font-sans select-none overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #06b6d4 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

            <div className="relative w-full max-w-5xl h-[85vh] flex bg-slate-950/90 border border-slate-700 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex-col md:flex-row">

                {/* --- LEFT SIDEBAR: NAVIGATION --- */}
                <div className="w-full md:w-64 bg-slate-900/50 border-r border-slate-700/50 flex flex-col p-4 gap-2 backdrop-blur relative overflow-hidden">
                    {/* Header */}
                    <div className="mb-8 pl-2 border-l-4 border-cyan-500">
                        <h2 className="text-3xl font-black italic text-white tracking-tighter leading-none">SYSTEM</h2>
                        <h3 className="text-sm font-bold text-cyan-500 tracking-[0.3em]">CONFIG</h3>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex flex-col gap-2 flex-1">
                        <NavButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="GENERAL" icon="⚙️" sub="一般設定" />
                        <NavButton active={activeTab === 'keyboard'} onClick={() => setActiveTab('keyboard')} label="CONTROLS" icon="⌨️" sub="鍵盤配置" />
                        <NavButton active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')} label="TOUCH" icon="📱" sub="觸控介面" />
                        {multiplayer?.isActive && (
                            <NavButton
                                active={activeTab === 'room'}
                                onClick={() => setActiveTab('room')}
                                label={isHost ? "R.ADMIN" : "LOBBY"}
                                icon="📡"
                                sub={isHost ? "房間管理" : "連線資訊"}
                                alert={multiplayer.manager && multiplayer.manager.pendingRequests.length > 0}
                            />
                        )}
                    </nav>

                    {/* Footer Actions */}
                    <div className="mt-auto space-y-2">
                        <button
                            onClick={onResume}
                            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black italic text-lg skew-x-[-6deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        >
                            <span className="skew-x-[6deg] block">RESUME // 繼續</span>
                        </button>
                        <button
                            onClick={onQuit}
                            className="w-full py-2 bg-red-950/50 hover:bg-red-900/80 text-red-200 border border-red-900 hover:border-red-500 font-bold text-sm transition-all"
                        >
                            QUIT TO MENU
                        </button>
                    </div>
                </div>

                {/* --- RIGHT CONTENT: SETTINGS PANELS --- */}
                <div className="flex-1 relative overflow-y-auto no-scrollbar bg-gradient-to-br from-slate-900/50 to-black/50 p-6 md:p-10">
                    {/* Inner Decorative Grid */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] pointer-events-none rounded-full" />

                    {vedalMessage && (
                        <div className="mb-6 bg-pink-900/20 border-l-2 border-pink-500 p-3 rounded-r text-pink-300 text-xs font-mono font-bold animate-pulse flex items-center gap-3 max-w-2xl">
                            <span className="text-xl">💬</span>
                            <span>{vedalMessage}</span>
                        </div>
                    )}

                    {/* TAB: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <SectionHeader title="PROFILE & IDENTITY" subtitle="個人檔案與識別" />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ControlCard label="OPERATOR NAME" sub="外送員代號">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={playerName || ''}
                                            onChange={(e) => !isLoggedIn && onUpdateName?.(e.target.value.slice(0, 12))}
                                            disabled={isLoggedIn}
                                            className={`w-full bg-slate-950 border-b-2 ${nameError ? 'border-red-500' : 'border-slate-700 focus:border-cyan-500'} text-white font-black italic text-xl px-2 py-1 outline-none transition-colors ${isLoggedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        />
                                        {isLoggedIn && <div className="absolute right-0 top-2 text-[10px] text-cyan-500 font-bold uppercase tracking-widest">LOCKED (LOGIN)</div>}
                                        {nameError && <div className="text-red-500 text-xs font-bold mt-1 animate-pulse">{nameError}</div>}
                                    </div>
                                </ControlCard>

                                <ControlCard label="NEURO PERSONA" sub="人格模組切換">
                                    <div className="flex gap-2 p-1 bg-slate-950 rounded border border-slate-800">
                                        <PersonaButton
                                            active={persona === Persona.NEURO}
                                            onClick={() => onUpdatePersona(Persona.NEURO)}
                                            label="NEURO"
                                            color="pink"
                                        />
                                        <PersonaButton
                                            active={persona === Persona.EVIL}
                                            onClick={() => onUpdatePersona(Persona.EVIL)}
                                            label="EVIL"
                                            color="red"
                                        />
                                    </div>
                                </ControlCard>
                            </div>

                            <SectionHeader title="SYSTEM CONFIGURATION" subtitle="系統參數設定" />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ControlCard label="FLIGHT ASSIST" sub="飛行輔助系統 (難度)">
                                    <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
                                        <div className="text-xs text-slate-400 font-mono px-2">
                                            {difficulty === 'NORMAL' ? 'MANUAL CONTROL (手動)' : 'AUTO STABILIZE (輔助)'}
                                        </div>
                                        <button
                                            onClick={onDifficultyToggle}
                                            className={`px-4 py-1 rounded font-bold text-sm transition-all ${difficulty === 'NORMAL' ? 'bg-yellow-600 text-white' : 'bg-green-600 text-white'}`}
                                        >
                                            {difficulty}
                                        </button>
                                    </div>
                                </ControlCard>

                                <ControlCard label="INTERFACE MODE" sub="操作介面模式">
                                    <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800 mt-4">
                                        <div className="text-xs text-slate-400 font-mono px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                                            {isMobileMode ? 'TOUCH CONTROLS (觸控)' : 'KEYBOARD & MOUSE (鍵鼠)'}
                                        </div>
                                        <ToggleButton isActive={!!isMobileMode} onClick={onToggleMobileMode} />
                                    </div>
                                </ControlCard>
                            </div>

                            <div className="bg-slate-900/30 border border-cyan-900/30 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-cyan-400 font-bold text-sm tracking-widest">NETWORK SYNC RATE // 連線同步率</label>
                                    <InfoTooltip text="高同步率可提供更流暢的遠端玩家動態，但會增加網路流量。" />
                                </div>
                                <div className="flex gap-1 bg-slate-950 p-1 rounded">
                                    {(['low', 'med', 'high'] as const).map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => setMpUpdateRate(rate)}
                                            className={`flex-1 py-2 text-xs font-bold transition-all rounded ${mpUpdateRate === rate ? 'bg-cyan-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {rate.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isLoggedIn && (
                                <div className="pt-6 border-t border-slate-800/50">
                                    <div className="flex flex-col gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                        {!isAdmin && (
                                            <div className="flex gap-2 items-end">
                                                <div className="flex-1">
                                                    <div className="text-[10px] text-slate-500 font-bold mb-1">PROMOTION CODE</div>
                                                    <input
                                                        type="text"
                                                        value={inviteCode}
                                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                                        placeholder="ENTER CODE"
                                                        className="w-full bg-slate-950 border border-slate-700 px-3 py-1 text-sm text-white outline-none focus:border-cyan-500 font-mono"
                                                    />
                                                </div>
                                                <button onClick={() => { if (inviteCode) { onRedeemCode?.(inviteCode); setInviteCode(''); } }} className="px-4 py-1.5 bg-slate-700 hover:bg-cyan-600 text-white text-xs font-bold transition-colors">
                                                    REDEEM
                                                </button>
                                            </div>
                                        )}
                                        <button onClick={() => { if (confirm("Log out?")) onLogout?.(); }} className="text-xs text-red-400 hover:text-red-300 underline self-start">
                                            Logout from terminal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: KEYBOARD */}
                    {activeTab === 'keyboard' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <SectionHeader title="KEY BINDINGS" subtitle="鍵盤按鍵配置" />
                            <p className="text-slate-400 text-sm mb-4 bg-slate-900/50 p-3 border-l-2 border-cyan-500">
                                Click a slot to rebind. Press 'Esc' to cancel binding.
                            </p>

                            <div className="space-y-2">
                                <KeyBindRow label="FORWARD THRUST" sub="推進" keyVal={controls.keys.thrust} isBinding={bindingKey === 'thrust'} onClick={() => setBindingKey('thrust')} />
                                <KeyBindRow label="ROTATE LEFT" sub="左旋轉" keyVal={controls.keys.left} isBinding={bindingKey === 'left'} onClick={() => setBindingKey('left')} />
                                <KeyBindRow label="ROTATE RIGHT" sub="右旋轉" keyVal={controls.keys.right} isBinding={bindingKey === 'right'} onClick={() => setBindingKey('right')} />
                                <KeyBindRow label="SYSTEM PAUSE" sub="暫停選單" keyVal={controls.keys.pause} isBinding={bindingKey === 'pause'} onClick={() => setBindingKey('pause')} />
                            </div>
                        </div>
                    )}

                    {/* TAB: MOBILE */}
                    {activeTab === 'mobile' && (
                        <div className="flex flex-col h-full items-center justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                            <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-pink-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                                <span className="text-4xl">📱</span>
                            </div>

                            <div>
                                <h2 className="text-3xl font-black italic text-white mb-2">TOUCH LAYOUT EDITOR</h2>
                                <p className="text-slate-400 max-w-md mx-auto">
                                    Enter layout editing mode to drag and reposition on-screen controls. The game will strictly pause during editing.
                                </p>
                            </div>

                            <button
                                onClick={() => { onStartLayoutEdit(); onResume(); }}
                                className="group relative px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white font-black italic text-xl transition-all hover:scale-105 active:scale-95 skew-x-[-12deg]"
                            >
                                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 skew-x-[12deg] overflow-hidden" />
                                <span className="skew-x-[12deg] inline-block">ENTER EDITOR // 啟動編輯</span>
                            </button>
                        </div>
                    )}

                    {/* TAB: ROOM (ADMIN) */}
                    {activeTab === 'room' && multiplayer?.isActive && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <SectionHeader title={isHost ? "ROOM ADMINISTRATION" : "LOBBY STATUS"} subtitle={isHost ? "房間管理控制台" : "大廳狀態資訊"} />

                            {/* Host Controls */}
                            {isHost && mpManager && (
                                <div className="bg-slate-900/50 border border-yellow-600/30 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-yellow-500 font-bold text-sm tracking-widest">AUTO-JOIN ALLOWANCE</span>
                                            <span className="text-[10px] text-slate-500">Allow strangers to join automatically?</span>
                                        </div>
                                        <ToggleButton isActive={!!multiplayer.autoJoin} onClick={() => multiplayer.onToggleAutoJoin?.()} color="yellow" />
                                    </div>

                                    <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
                                        <div className="flex-1">
                                            <span className="text-xs text-slate-400 font-bold block mb-1">FORCE SEED</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={localSeed}
                                                    onChange={(e) => setLocalSeed(e.target.value.toUpperCase())}
                                                    className="flex-1 bg-black/50 border border-slate-600 px-2 py-1 text-yellow-400 font-mono text-sm"
                                                    placeholder="SEED..."
                                                />
                                                <button onClick={() => onUpdateSeed?.(localSeed)} className="bg-purple-700 hover:bg-purple-600 text-white text-xs px-3 font-bold">APPLY</button>
                                            </div>
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => { if (confirm("RESTART ALL?")) onForceRestart?.(); }}
                                                className="bg-red-600 hover:bg-red-500 text-white font-black italic px-4 py-3 text-xs shadow-lg active:scale-95"
                                            >
                                                RESTART ALL
                                            </button>
                                        </div>
                                    </div>

                                    {/* Requests */}
                                    {mpManager.pendingRequests.length > 0 && (
                                        <div className="bg-yellow-900/20 border border-yellow-600/50 p-2 rounded">
                                            <div className="text-[10px] text-yellow-500 font-bold mb-2">PENDING REQUESTS</div>
                                            <div className="space-y-1">
                                                {mpManager.pendingRequests.map(req => (
                                                    <div key={req.id} className="flex justify-between items-center bg-black/40 p-1 px-2 rounded">
                                                        <span className="text-xs text-white">{req.name}</span>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => mpManager.approveJoin(req.id, localSeed)} className="text-[10px] bg-green-600 px-2 text-white">YES</button>
                                                            <button onClick={() => mpManager.rejectJoin(req.id)} className="text-[10px] bg-red-600 px-2 text-white">NO</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Player List */}
                            <div className="space-y-2">
                                <div className="text-xs text-cyan-500 font-bold tracking-widest border-b border-cyan-900/50 pb-1 mb-2">CONNECTED OPERATORS</div>
                                <div className="grid grid-cols-1 gap-2">
                                    {roomParticipants?.length ? roomParticipants.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-slate-900 p-3 border-l-2 border-slate-700 hover:border-cyan-500 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${p.id === mpManager?.myId ? 'bg-cyan-400 shadow-[0_0_5px_cyan]' : 'bg-green-500'}`} />
                                                <span className={`font-mono font-bold ${p.id === mpManager?.myId ? 'text-white' : 'text-slate-300'}`}>
                                                    {p.name}
                                                </span>
                                                {p.id === (mpManager?.myId || 'HOST') && <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1 rounded">HOST</span>}
                                            </div>
                                            {isHost && p.id !== mpManager?.myId && (
                                                <button onClick={() => mpManager?.kick(p.id)} className="opacity-0 group-hover:opacity-100 bg-red-900/80 text-red-200 text-[10px] px-2 py-1 hover:bg-red-600 transition-all">
                                                    KICK
                                                </button>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="text-slate-500 text-sm italic py-4 text-center">No other operators connected.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

// --- Sub Components ---

const NavButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: string; sub: string; alert?: boolean }> = ({ active, onClick, label, icon, sub, alert }) => (
    <button
        onClick={onClick}
        className={`relative w-full text-left p-3 pl-4 transition-all duration-200 group overflow-hidden ${active ? 'bg-cyan-950/40 border-l-4 border-cyan-400' : 'hover:bg-white/5 border-l-4 border-transparent'}`}
    >
        <div className="relative z-10 flex flex-col items-start leading-none">
            <div className={`text-lg font-black italic flex items-center gap-2 ${active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'}`}>
                <span className="opacity-80 text-sm">{icon}</span>
                {label}
                {alert && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </div>
            <div className={`text-[10px] font-mono mt-1 ${active ? 'text-cyan-600' : 'text-slate-600'}`}>{sub}</div>
        </div>
        {active && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent pointer-events-none" />}
    </button>
);

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h3 className="text-xl font-black italic text-white tracking-wider flex items-center gap-2">
            <span className="w-8 h-1 bg-cyan-500 inline-block skew-x-[-12deg]" />
            {title}
        </h3>
        <p className="text-xs text-slate-500 font-mono pl-10 opacity-70">{subtitle}</p>
    </div>
);

const ControlCard: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({ label, sub, children }) => (
    <div className="flex flex-col gap-2">
        <label className="flex flex-col leading-none">
            <span className="text-xs font-bold text-slate-300 tracking-wider">{label}</span>
            {sub && <span className="text-[10px] text-slate-500 font-mono">{sub}</span>}
        </label>
        {children}
    </div>
);

const ToggleButton: React.FC<{ isActive: boolean; onClick: any; color?: string }> = ({ isActive, onClick, color = 'cyan' }) => (
    <button
        onClick={onClick}
        className={`w-12 h-6 rounded px-0.5 transition-colors border ${isActive ? (color === 'yellow' ? 'bg-yellow-900 border-yellow-500' : 'bg-cyan-900 border-cyan-500') : 'bg-slate-900 border-slate-600'}`}
    >
        <div className={`w-4 h-4 rounded shadow-sm bg-white transition-transform ${isActive ? 'translate-x-[22px]' : 'translate-x-0'}`} />
    </button>
);

const PersonaButton: React.FC<{ active: boolean; onClick: () => void; label: string; color: string }> = ({ active, onClick, label, color }) => {
    const activeClass = color === 'pink' ? 'bg-pink-600 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(220,38,38,0.5)]';
    return (
        <button
            onClick={onClick}
            className={`flex-1 py-1 text-sm font-black italic transition-all border border-transparent rounded ${active ? activeClass : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
        >
            {label}
        </button>
    );
};

const KeyBindRow: React.FC<{ label: string; sub: string; keyVal: string; isBinding: boolean; onClick: () => void }> = ({ label, sub, keyVal, isBinding, onClick }) => (
    <div
        onClick={onClick}
        className={`flex justify-between items-center p-3 border-l-2 cursor-pointer transition-all bg-gradient-to-r ${isBinding ? 'from-pink-900/20 border-pink-500 to-transparent' : 'from-slate-900 border-slate-700 to-transparent hover:border-cyan-500 hover:from-cyan-900/10'}`}
    >
        <div className="flex flex-col">
            <span className={`font-bold text-sm ${isBinding ? 'text-pink-400' : 'text-slate-300'}`}>{label}</span>
            <span className="text-[10px] text-slate-500 font-mono">{sub}</span>
        </div>
        <div className={`min-w-[80px] text-center py-1 px-3 rounded font-mono font-bold text-xs ${isBinding ? 'bg-pink-600 text-white animate-pulse' : 'bg-black/40 border border-slate-700 text-yellow-400'}`}>
            {isBinding ? 'PRESS KEY' : keyVal.toUpperCase()}
        </div>
    </div>
);
