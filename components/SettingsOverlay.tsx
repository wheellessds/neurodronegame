
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
        <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto font-vt323">
            <div className={`bg-slate-900 border-4 border-cyan-500 w-full max-w-md rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.5)] flex flex-col max-h-[90vh] ${activeTab === 'room' ? 'max-w-lg' : ''}`}>
                {/* Header */}
                <div className="bg-cyan-900/50 p-4 border-b-2 border-cyan-500 flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-cyan-400 tracking-widest">SYSTEM SETTINGS</h2>
                    <button onClick={onResume} className="text-white bg-red-600/50 hover:bg-red-600 px-3 py-1 rounded-lg border border-red-500 transition-colors">
                        X
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-cyan-800 bg-slate-800/50">
                    <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="GENERAL" />
                    <TabButton active={activeTab === 'keyboard'} onClick={() => setActiveTab('keyboard')} label="KEYBOARD" />
                    <TabButton active={activeTab === 'mobile'} onClick={() => setActiveTab('mobile')} label="MOBILE" />
                    {multiplayer?.isActive && <TabButton active={activeTab === 'room'} onClick={() => setActiveTab('room')} label={isHost ? "ADMIN (管理)" : "ROOM (房間)"} />}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                    {vedalMessage && (
                        <div className="bg-pink-900/30 border border-pink-500/50 p-3 rounded-lg text-pink-300 text-xs font-bold animate-pulse flex items-center gap-2">
                            <span>💬</span>
                            <span>{vedalMessage}</span>
                        </div>
                    )}
                    {activeTab === 'general' && (
                        <div className="space-y-4">
                            <SettingItem label="PLAYER NAME (暱稱)" info={isLoggedIn ? "外送員已報到，無法更改暱稱。" : "設定在排行榜和多人模式中顯示的名稱。"}>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={playerName || ''}
                                        onChange={(e) => !isLoggedIn && onUpdateName?.(e.target.value.slice(0, 12))}
                                        disabled={isLoggedIn}
                                        className={`bg-black/50 border border-cyan-500 rounded px-2 py-1 text-yellow-400 font-bold w-32 outline-none focus:ring-1 focus:ring-cyan-500 ${isLoggedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    {nameError && (
                                        <div className="absolute top-full left-0 mt-1 text-red-500 text-[10px] font-bold whitespace-nowrap bg-black/80 px-1 rounded z-10 animate-pulse">
                                            ⚠️ {nameError}
                                        </div>
                                    )}
                                </div>
                            </SettingItem>

                            {isLoggedIn && (
                                <div className="pt-4 border-t border-slate-700/50 space-y-4">
                                    {!isAdmin && (
                                        <div className="bg-slate-800/50 p-3 rounded-lg border border-cyan-900/50">
                                            <label className="text-cyan-400 font-bold text-xs mb-2 block tracking-widest flex items-center gap-1">
                                                INVITATION CODE (邀請碼)
                                                <InfoTooltip text="輸入特定邀請碼以獲得最高管理權限。" />
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={inviteCode}
                                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                                    placeholder="ENTER CODE..."
                                                    className="flex-1 bg-black/50 border border-slate-600 rounded px-2 py-1 text-cyan-400 font-mono text-sm outline-none focus:border-cyan-500 transition-colors"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (inviteCode) {
                                                            onRedeemCode?.(inviteCode);
                                                            setInviteCode('');
                                                        }
                                                    }}
                                                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-1 rounded text-xs transition-all active:scale-95"
                                                >
                                                    REDEEM (兌換)
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (confirm("確定要登出系統嗎？")) {
                                                onLogout?.();
                                            }
                                        }}
                                        className="w-full bg-red-950/40 hover:bg-red-600 text-red-200 font-bold py-2 px-4 rounded border border-red-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 group"
                                    >
                                        <span className="text-lg">🚪</span>
                                        LOGOUT (登出帳號)
                                    </button>
                                </div>
                            )}

                            <SettingItem label="DIFFICULTY (難度)" info="切換操作模式。普通模式全手動；簡單模式有無人機自動找正功能。">
                                <button
                                    onClick={onDifficultyToggle}
                                    className="bg-slate-800 border-2 border-cyan-500 px-4 py-1 text-yellow-400 font-bold hover:bg-slate-700 transition-colors rounded"
                                >
                                    {difficulty}
                                </button>
                            </SettingItem>
                            <SettingItem label="AVATAR (頭像)" info="Neuro 有隨機性能延遲；Evil Neuro 推力強大但燃料消耗更快。">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onUpdatePersona(Persona.NEURO)}
                                        className={`px-3 py-1 rounded font-bold border-2 transition-all ${persona === Persona.NEURO ? 'bg-pink-600 border-pink-400 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-pink-500/50'}`}
                                    >
                                        NEURO
                                    </button>
                                    <button
                                        onClick={() => onUpdatePersona(Persona.EVIL)}
                                        className={`px-3 py-1 rounded font-bold border-2 transition-all ${persona === Persona.EVIL ? 'bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-red-500/50'}`}
                                    >
                                        EVIL
                                    </button>
                                </div>
                            </SettingItem>
                            <SettingItem label="MOBILE MODE (手機模式)" info="手動開啟或關閉手機虛擬按鍵。">
                                <button
                                    onClick={onToggleMobileMode}
                                    className={`w-16 h-8 rounded-full transition-colors relative border-2 border-cyan-700 ${isMobileMode ? 'bg-pink-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${isMobileMode ? 'translate-x-8' : ''}`} />
                                </button>
                            </SettingItem>

                            <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                                <label className="flex items-center gap-1 text-cyan-400 font-bold mb-2 tracking-widest text-sm">
                                    MP SYNC RATE (連線頻率)
                                    <InfoTooltip text="此設定會強制同步至全房間。設定越高，你看到的其它玩家就越流暢（因為所有人傳輸頻率都會提高），但也更吃網路流量。" />
                                </label>
                                <div className="flex gap-2">
                                    {(['low', 'med', 'high'] as const).map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => setMpUpdateRate(rate)}
                                            className={`flex-1 py-4 rounded font-bold transition-all border-2 ${mpUpdateRate === rate
                                                ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            {rate.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>


                        </div>
                    )}

                    {activeTab === 'keyboard' && (
                        <div className="space-y-3">
                            <p className="text-gray-400 text-sm mb-4">Click a category then press any key to remap. (點擊後按鍵盤設定)</p>
                            <KeyBindRow
                                label="THRUST (推進)"
                                keyVal={controls.keys.thrust}
                                isBinding={bindingKey === 'thrust'}
                                onClick={() => setBindingKey('thrust')}
                            />
                            <KeyBindRow
                                label="LEFT (左轉)"
                                keyVal={controls.keys.left}
                                isBinding={bindingKey === 'left'}
                                onClick={() => setBindingKey('left')}
                            />
                            <KeyBindRow
                                label="RIGHT (右轉)"
                                keyVal={controls.keys.right}
                                isBinding={bindingKey === 'right'}
                                onClick={() => setBindingKey('right')}
                            />
                            <KeyBindRow
                                label="PAUSE (暫停)"
                                keyVal={controls.keys.pause}
                                isBinding={bindingKey === 'pause'}
                                onClick={() => setBindingKey('pause')}
                            />
                        </div>
                    )}

                    {activeTab === 'mobile' && (
                        <div className="space-y-4 text-center">
                            <p className="text-gray-400 text-sm flex items-center justify-center gap-1">
                                Customize touch button positions by dragging. (透過拖拽自定義按鍵位置)
                                <InfoTooltip text="進入按鍵位置調整模式，在此模式下遊戲會暫停。" />
                            </p>
                            <button
                                onClick={() => { onStartLayoutEdit(); onResume(); }}
                                className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-4 rounded-xl shadow-lg border-2 border-pink-400 border-dashed animate-pulse"
                            >
                                EDIT LAYOUT (調整按鍵位置)
                            </button>
                            <p className="text-pink-400/70 text-xs mt-2 italic">Dragging is active globally when you exit this menu in edit mode.</p>
                        </div>
                    )}

                    {activeTab === 'room' && multiplayer?.isActive && (
                        <div className="space-y-6">
                            {/* Host Controls */}
                            {isHost && mpManager && (
                                <div className="space-y-4 border-b border-slate-700 pb-4">
                                    <h3 className="text-cyan-400 font-bold text-xl border-l-4 border-cyan-500 pl-2">ROOM SETTINGS</h3>



                                    {/* Auto Join Toggle */}
                                    <SettingItem label="AUTO JOIN (自動加入)" info="開啟後，系統將自動請求加入最近的公開房間。">
                                        <button
                                            onClick={() => multiplayer.onToggleAutoJoin?.()}
                                            className={`px-3 py-1 rounded font-bold ${multiplayer.autoJoin ? 'bg-green-600 text-white' : 'bg-red-900 text-gray-400'}`}
                                        >
                                            {multiplayer.autoJoin ? "ON" : "OFF"}
                                        </button>
                                    </SettingItem>

                                    {/* Seed Control */}
                                    <div className="flex flex-col gap-2 bg-slate-800/30 p-3 rounded-lg border border-slate-700">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white font-bold flex items-center">
                                                WORLD SEED
                                                <InfoTooltip text="輸入特定的種子代碼，可生成固定的隧道地形與朋友比賽。" />
                                            </span>
                                            <button
                                                onClick={() => {
                                                    if (onUpdateSeed) onUpdateSeed(localSeed);
                                                    // Logic to restart game would be external
                                                }}
                                                className="bg-purple-600 hover:bg-purple-500 px-3 py-0.5 rounded text-xs text-white"
                                            >
                                                APPLY & RESTART
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={localSeed}
                                            onChange={(e) => setLocalSeed(e.target.value.toUpperCase())}
                                            className="bg-black/50 border border-slate-600 rounded p-2 text-yellow-400 font-mono tracking-widest uppercase"
                                        />
                                    </div>



                                    {/* Pending Requests */}
                                    {mpManager.pendingRequests.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-yellow-400 font-bold text-sm">PENDING APPROVALS ({mpManager.pendingRequests.length})</h4>
                                            {mpManager.pendingRequests.map(req => (
                                                <div key={req.id} className="flex justify-between items-center bg-slate-800 p-2 rounded">
                                                    <span className="text-white text-sm">{req.name} <span className="text-slate-500 text-xs">({req.id.slice(-4)})</span></span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => mpManager.approveJoin(req.id, localSeed)} className="bg-green-600 px-2 py-0.5 rounded text-xs hover:bg-green-500">ACCEPT</button>
                                                        <button onClick={() => mpManager.rejectJoin(req.id)} className="bg-red-600 px-2 py-0.5 rounded text-xs hover:bg-red-500">REJECT</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Dangerous Actions */}
                                    <div className="pt-4 border-t border-slate-700">
                                        <button
                                            onClick={() => {
                                                if (confirm("確定要強制重啟所有玩家嗎？ (FORCE RESTART ALL?)")) {
                                                    onForceRestart?.();
                                                }
                                            }}
                                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded shadow-lg transition-transform active:scale-95"
                                        >
                                            FORCE RESTART ALL (強制全員重啟)
                                        </button>
                                        <p className="text-[10px] text-red-400 mt-1 text-center font-sans tracking-normal">此操作將重置包含您在內的所有玩家至起點。</p>
                                    </div>
                                </div>
                            )}

                            {/* Player List */}
                            <div className="space-y-2 pt-4">
                                <h3 className="text-pink-400 font-bold text-xl border-l-4 border-pink-500 pl-2">PLAYERS</h3>
                                {roomParticipants && roomParticipants.length > 0 ? (
                                    roomParticipants.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                <span className={`${p.id === mpManager?.myId ? 'text-cyan-300 font-bold' : 'text-white'}`}>
                                                    {p.name} {p.id === mpManager?.myId && "(YOU)"}
                                                </span>
                                            </div>
                                            {isHost && p.id !== mpManager?.myId && (
                                                <button
                                                    onClick={() => mpManager?.kick(p.id)}
                                                    className="bg-red-900/50 hover:bg-red-600 border border-red-800 text-red-200 text-xs px-2 py-1 rounded transition-colors"
                                                >
                                                    KICK
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-cyan-900/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-cyan-300 font-bold">{playerName} (YOU)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-800/80 border-t border-cyan-800 flex flex-col items-center gap-4">
                    <button
                        onClick={onResume}
                        className="w-full max-w-sm bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-12 rounded-full text-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all active:scale-95"
                    >
                        RESUME (繼續)
                    </button>

                    <div className="w-full max-w-sm pt-2 border-t border-slate-700/50">
                        <button
                            onClick={onQuit}
                            className="w-full bg-red-900/40 hover:bg-red-600 border-2 border-red-700 text-red-100 py-2 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span className="text-lg">🏠</span>
                            QUIT TO MENU (回到選單)
                        </button>
                        <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] mt-1">
                            <span>點擊放棄任務並返回主畫面</span>
                            <InfoTooltip text="放棄當前任務並回到主選單。未存檔的積分將會消失。" />
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 font-bold tracking-widest text-sm transition-all ${active ? 'text-cyan-400 bg-slate-900 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {label}
    </button>
);

const SettingItem: React.FC<{ label: string; children: React.ReactNode; info?: string }> = ({ label, children, info }) => (
    <div className="flex justify-between items-center bg-slate-800/30 p-3 rounded-lg border border-slate-700">
        <span className="text-white font-bold text-lg flex items-center">
            {label}
            {info && <InfoTooltip text={info} />}
        </span>
        {children}
    </div>
);

const KeyBindRow: React.FC<{ label: string; keyVal: string; isBinding: boolean; onClick: () => void }> = ({ label, keyVal, isBinding, onClick }) => (
    <div
        onClick={onClick}
        className={`flex justify-between items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${isBinding ? 'border-pink-500 bg-pink-500/10' : 'border-slate-700 bg-slate-800/30 hover:border-cyan-500/50'}`}
    >
        <span className="text-white font-bold">{label}</span>
        <span className={`px-4 py-1 rounded font-mono font-bold ${isBinding ? 'text-pink-400 animate-pulse' : 'text-yellow-400 bg-black/40 border border-slate-600'}`}>
            {isBinding ? 'PRESS ANY KEY' : keyVal.toUpperCase()}
        </span>
    </div>
);
