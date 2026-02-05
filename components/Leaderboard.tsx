
import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    onClose: () => void;
    onExport?: () => void;
    onChallengeSeed?: (seed: string | LeaderboardEntry) => void;
    isAdmin?: boolean;
    token?: string;
    onEntryDeleted?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, onClose, onExport, onChallengeSeed, isAdmin, token, onEntryDeleted }) => {
    const [showLegacy, setShowLegacy] = React.useState(true);
    const [isDeleting, setIsDeleting] = React.useState<number | null>(null);

    const handleDeleteEntry = async (index: number) => {
        if (!confirm("確定要刪除此條分數紀錄嗎？")) return;
        setIsDeleting(index);
        try {
            const res = await fetch('/api/admin/delete-entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, entryIndex: index })
            });
            if (res.ok) {
                onEntryDeleted?.();
            } else {
                alert("刪除失敗。");
            }
        } catch (e) {
            console.error("Delete failed", e);
        } finally {
            setIsDeleting(null);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const filteredEntries = entries.filter(entry => showLegacy || entry.seed);

    return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900/90 backdrop-blur-md p-6 rounded-xl border border-slate-700 shadow-2xl relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />

            <h2 className="text-4xl font-bold text-cyan-400 mb-6 tracking-widest font-vt323">
                🏆 傳說中的快遞員排行榜 🏆
            </h2>

            <div className="w-full max-w-4xl overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '60vh' }}>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-sm italic">
                            <th className="py-2 px-4">排名</th>
                            <th className="py-2 px-4">玩家</th>
                            <th className="py-2 px-4 text-center">難度</th>
                            <th className="py-2 px-4 text-center">裝置</th>
                            <th className="py-2 px-4 text-center">種子碼</th>
                            <th className="py-2 px-4 text-right">距離</th>
                            <th className="py-2 px-4 text-right">時間</th>
                            <th className="py-2 px-4 text-center">日期</th>
                            {isAdmin && <th className="py-2 px-4 text-center">管理</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEntries.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-slate-500 italic">尚未有航行紀錄（或已隱藏舊版紀錄）...</td>
                            </tr>
                        ) : (
                            filteredEntries.map((entry, index) => (
                                <tr
                                    key={index}
                                    className={`group hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 ${index === 0 ? 'text-yellow-400 font-bold' : 'text-slate-300'}`}
                                >
                                    <td className="py-3 px-4">
                                        {index === 0 && '🥇 '}
                                        {index === 1 && '🥈 '}
                                        {index === 2 && '🥉 '}
                                        {index > 2 && `${index + 1}.`}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${entry.persona === 'NEURO' ? 'bg-pink-500' : 'bg-red-600'}`} title={entry.persona} />
                                            {entry.name}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center text-sm">
                                        <span className={`px-2 py-0.5 rounded text-[10px] border ${entry.difficulty === 'EASY' ? 'border-green-500 text-green-400 bg-green-500/10' : 'border-red-500 text-red-400 bg-red-500/10'}`}>
                                            {entry.difficulty === 'EASY' ? '簡單' : '普通'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-lg">
                                        {entry.isMobile ? '📱' : '💻'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {entry.seed ? (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onChallengeSeed?.(entry)}
                                                    className="bg-slate-700 hover:bg-pink-600 text-[10px] px-2 py-1 rounded-md font-mono text-cyan-300 hover:text-white transition-all active:scale-90"
                                                    title="挑戰此地圖種子與幻影 (Challenge this seed & ghost)"
                                                >
                                                    {entry.seed}
                                                </button>
                                                {entry.trajectory && entry.trajectory.length > 0 && (
                                                    <span title="包含 Ghost 重播" className="cursor-help text-xs">👻</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600">---</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono">{entry.distance}m</td>
                                    <td className="py-3 px-4 text-right font-mono text-cyan-500">{formatTime(entry.time)}</td>
                                    <td className="py-3 px-4 text-center text-xs text-slate-500">{entry.date}</td>
                                    {isAdmin && (
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                onClick={() => handleDeleteEntry(index)}
                                                disabled={isDeleting !== null}
                                                className="bg-red-900/50 hover:bg-red-600 text-red-100 text-[10px] px-2 py-1 rounded border border-red-700 transition-colors"
                                            >
                                                {isDeleting === index ? '...' : '刪除紀錄'}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-8 flex gap-4 w-full max-w-lg">
                <button
                    onClick={onClose}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-all border border-slate-500 shadow-lg"
                >
                    返回選單
                </button>
                <div className="flex-1 flex gap-2">
                    <button
                        onClick={() => setShowLegacy(!showLegacy)}
                        className={`flex-1 font-bold py-2 rounded-lg transition-all border shadow-lg ${showLegacy ? 'bg-orange-600 hover:bg-orange-500 border-orange-400 text-white' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-gray-400'}`}
                    >
                        {showLegacy ? '隱藏舊版' : '顯示舊版'}
                    </button>
                    {onExport && (
                        <button
                            onClick={onExport}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-all border border-cyan-400 shadow-lg"
                        >
                            匯出
                        </button>
                    )}
                </div>
            </div>

            <p className="mt-4 text-[10px] text-slate-600 uppercase tracking-widest">Local Leaderboard v2.0 - Auto-saved to leaderboard.json</p>
        </div>
    );
};
