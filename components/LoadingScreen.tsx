import React from 'react';

interface LoadingScreenProps {
    progress: number;
    message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, message = "Loading Neural Networks..." }) => {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-900 text-white font-vt323">
            <div className="max-w-md w-full px-8 flex flex-col items-center">
                <h1 className="text-5xl font-bold text-pink-400 mb-8 tracking-widest animate-pulse">
                    INITIALIZING...
                </h1>

                <div className="w-full h-8 bg-slate-800 border-2 border-slate-700 rounded-full overflow-hidden mb-4 p-1 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                    <div
                        className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-full transition-all duration-300 ease-out flex items-center justify-end px-2"
                        style={{ width: `${progress}%` }}
                    >
                        {progress > 15 && <span className="text-[10px] font-bold text-white drop-shadow-md">{progress}%</span>}
                    </div>
                </div>

                <p className="text-cyan-400 text-xl tracking-wider text-center h-8">
                    {message}
                </p>

                <div className="mt-12 flex gap-4 opacity-50">
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                </div>

                <div className="absolute bottom-8 text-slate-500 text-sm tracking-widest uppercase">
                    Neuro's Drone Delivery Service v2.0
                </div>
            </div>
        </div>
    );
};
