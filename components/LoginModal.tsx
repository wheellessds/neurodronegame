import React, { useState } from 'react';
import { INITIAL_MONEY } from '../constants';

interface LoginModalProps {
    onLogin: (user: { username: string, token: string, saveData: any }) => void;
    onGuest: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onGuest }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const endpoint = isRegistering ? '/api/register' : '/api/login';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                onLogin({
                    username: data.username,
                    token: data.token,
                    saveData: data.saveData
                });
            } else {
                setError(data.error || 'Operation failed');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000, color: '#fff', fontFamily: 'monospace'
        }}>
            <div style={{
                background: '#1a1a1a', border: '2px solid #00ff9d',
                padding: '2rem', borderRadius: '10px', width: '400px',
                boxShadow: '0 0 20px rgba(0, 255, 157, 0.3)'
            }}>
                <h2 style={{ color: '#00ff9d', textAlign: 'center', marginBottom: '1.5rem' }}>
                    {isRegistering ? '註冊無人機 ID' : '無人機登入'}
                </h2>

                {error && <div style={{ color: '#ff4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>呼號 (CALLSIGN)</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            style={{
                                width: '100%', padding: '0.8rem', background: '#333',
                                border: '1px solid #444', color: '#fff', outline: 'none',
                                fontFamily: 'monospace'
                            }}
                            placeholder="輸入用戶名..."
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>訪問代碼 (PASSWORD)</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '0.8rem', background: '#333',
                                border: '1px solid #444', color: '#fff', outline: 'none',
                                fontFamily: 'monospace'
                            }}
                            placeholder="輸入密碼..."
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '1rem',
                            background: loading ? '#555' : '#00ff9d',
                            color: loading ? '#ccc' : '#000',
                            border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
                            marginBottom: '1rem'
                        }}
                    >
                        {loading ? '處理中...' : (isRegistering ? '建立新單位 (註冊)' : '認證身分 (登入)')}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: '#888', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => { setIsRegistering(!isRegistering); setError(null); }}>
                        {isRegistering ? '已經有帳號？登入' : '需要新單位 ID？註冊'}
                    </span>
                </div>

                <div style={{ borderTop: '1px solid #333', paddingTop: '1rem', marginTop: '1rem' }}>
                    <button
                        onClick={onGuest}
                        style={{
                            width: '100%', padding: '0.8rem',
                            background: 'transparent', border: '1px solid #666',
                            color: '#888', cursor: 'pointer'
                        }}
                    >
                        訪客遊玩 (無法存檔)
                    </button>
                </div>

                {isRegistering && (
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#00ff9d' }}>
                        <strong>註冊好處:</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', color: '#aaa' }}>
                            <li>保留專屬呼號</li>
                            <li>雲端存檔: 保留金幣 ($)</li>
                            <li>跨裝置同步</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
