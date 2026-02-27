
import React, { useState, useEffect } from 'react';

interface UserInfo {
    username: string;
    joinedAt: number;
    money: number;
}

interface UserManagementProps {
    token: string;
    onClose: () => void;
    onUserDeleted?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ token, onClose, onUserDeleted }) => {
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('api/admin/list-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error("Failed to fetch users", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [token]);

    const handleDeleteUser = async (username: string) => {
        if (username === 'Wheel' || username === 'Admin') {
            alert("無法刪除超級管理員帳號。");
            return;
        }
        if (!confirm(`確定要永久刪除用戶「${username}」及其所有資料嗎？`)) return;

        setIsDeleting(username);
        try {
            const res = await fetch('api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, username })
            });
            if (res.ok) {
                fetchUsers();
                onUserDeleted?.();
            } else {
                alert("刪除失敗。");
            }
        } catch (e) {
            console.error("Delete user failed", e);
        } finally {
            setIsDeleting(null);
        }
    };

    const formatDate = (timestamp: number) => {
        if (!timestamp) return '---';
        return new Date(timestamp).toLocaleString('zh-TW', { hour12: false });
    };

    return (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900/95 backdrop-blur-xl p-8 rounded-2xl border-2 border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] relative overflow-hidden font-vt323">
            <h2 className="text-4xl font-bold text-purple-400 mb-6 tracking-[0.2em] animate-pulse">
                🛡️ DATABASE ACCESS: USERS
            </h2>

            <div className="w-full max-w-2xl flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center py-20 italic text-purple-300 animate-pulse">掃描中 (SCANNING)...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-purple-900/50 text-purple-300/70 text-sm uppercase tracking-widest">
                                <th className="py-2 px-4">呼號 (ID)</th>
                                <th className="py-2 px-4">資產 ($)</th>
                                <th className="py-2 px-4">註冊日期</th>
                                <th className="py-2 px-4 text-center">指令</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.username} className="border-b border-white/5 hover:bg-purple-500/10 transition-colors">
                                    <td className="py-3 px-4 font-bold text-cyan-400">{u.username}</td>
                                    <td className="py-3 px-4 text-yellow-400">${u.money}</td>
                                    <td className="py-3 px-4 text-xs text-slate-500">{formatDate(u.joinedAt)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <button
                                            onClick={() => handleDeleteUser(u.username)}
                                            disabled={isDeleting !== null}
                                            className="bg-red-900/40 hover:bg-red-600/80 text-red-200 text-xs px-3 py-1 rounded border border-red-500/50 transition-all active:scale-95"
                                        >
                                            {isDeleting === u.username ? ' WIPING...' : 'DELETE'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <button
                onClick={onClose}
                className="mt-8 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-12 rounded-lg border-2 border-purple-500 shadow-lg tracking-widest transition-all active:scale-95"
            >
                EXIT TERMINAL
            </button>
        </div>
    );
};
