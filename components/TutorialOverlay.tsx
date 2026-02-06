import React, { useState, useEffect } from 'react';

interface TutorialOverlayProps {
    onComplete: () => void;
    onSkip: () => void;
}

interface Step {
    targetId: string;
    text: string;
    subtext?: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const STEPS: Step[] = [
    { targetId: 'none', text: "歡迎，操作員。", subtext: "Neuro Drone Deployment System\nInitialized...", position: 'center' },
    { targetId: 'settings-title', text: "系統設定", subtext: "Customize controls, audio, and avatar calibration.\n(點擊標題或頭像設定)", position: 'bottom' },
    { targetId: 'leaderboard-card', text: "全球排名", subtext: "View top-tier operative records.\n(查看全球外送員排名)", position: 'top' },
    { targetId: 'mp-toggle', text: "網路連結", subtext: "Toggle Multiplayer Connection.\nSortie with fellow drones or spectate.\n(開啟多人連線/觀戰)", position: 'bottom' },
    { targetId: 'login-btn', text: "用戶認證", subtext: "Login to save progress and access advanced features.\n(登入以保存進度和解鎖功能)", position: 'bottom' },
    { targetId: 'currency-display', text: "資源監控", subtext: "Track your credits earned from deliveries.\n(追蹤配送賺取的積分)", position: 'bottom' },
    { targetId: 'tutorial-btn', text: "檔案存取", subtext: "Replay this briefing anytime.\n(重看教學)", position: 'center' },
    { targetId: 'start-btn-neuro', text: "開始出擊", subtext: "Select an avatar to begin mission.\n(選擇角色開始配送)", position: 'top' }
];

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete, onSkip }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        const step = STEPS[currentStep];
        if (step.targetId === 'none') {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            const el = document.querySelector(`[data-tutorial-target="${step.targetId}"]`);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
            } else {
                setTargetRect(null);
            }
        };

        // Initial update
        updateRect();

        // Update on resize
        window.addEventListener('resize', updateRect);

        // Update on scroll (in case of layout shifts)
        window.addEventListener('scroll', updateRect);

        // Multiple delayed updates to handle animations and layout shifts
        const timeouts = [
            setTimeout(updateRect, 50),
            setTimeout(updateRect, 150),
            setTimeout(updateRect, 300),
            setTimeout(updateRect, 600),
            setTimeout(updateRect, 1000)
        ];

        // MutationObserver to watch for DOM changes
        const observer = new MutationObserver(() => {
            updateRect();
        });

        // Observe the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
            timeouts.forEach(clearTimeout);
            observer.disconnect();
        };
    }, [currentStep]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const step = STEPS[currentStep];

    return (
        <div
            className="fixed inset-0 z-[1000] overflow-hidden cursor-crosshair font-sans select-none"
            onClick={handleNext}
        >
            {/* Holographic Grid Background */}
            <div className="absolute inset-0 bg-slate-950/20 pointer-events-none">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            {/* Target Highlight Effect */}
            <div className={`absolute inset-0 transition-all duration-300 pointer-events-none`}>
                {targetRect && (
                    <div
                        className="absolute transition-all duration-300 pointer-events-none shadow-[0_0_30px_rgba(34,211,238,0.8)]"
                        style={{
                            left: targetRect.left - 10,
                            top: targetRect.top - 10,
                            width: targetRect.width + 20,
                            height: targetRect.height + 20,
                        }}
                    >
                        {/* Bright Highlight Overlay */}
                        <div className="absolute inset-2 bg-cyan-400/10 rounded-md animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.6)]" />

                        {/* Corner Brackets */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 animate-pulse" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 animate-pulse" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 animate-pulse" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 animate-pulse" />

                        {/* Connecting Lines */}
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyan-500/30" />
                        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-cyan-500/30" />
                    </div>
                )}
            </div>

            {/* Holographic Info Card */}
            <div
                className="absolute transition-all duration-500 pointer-events-none flex flex-col items-center"
                style={{
                    left: (() => {
                        if (!targetRect) return '50%';
                        const isMobile = window.innerWidth < 768;
                        if (isMobile) return '50%'; // Force horizontal center on mobile
                        let left;
                        if (step.position === 'center') return '50%';
                        if (step.position === 'left') left = targetRect.left - 350;
                        else if (step.position === 'right') left = targetRect.right + 50;
                        else left = targetRect.left + targetRect.width / 2;
                        
                        // Boundary check
                        const cardWidth = 400;
                        if (left < 20) left = 20;
                        if (left + cardWidth > window.innerWidth - 20) left = window.innerWidth - cardWidth - 20;
                        return left + 'px';
                    })(),
                    top: (() => {
                        if (!targetRect) return '50%';
                        const isMobile = window.innerWidth < 768;
                        let top;
                        if (step.position === 'center') return '50%';
                        if (step.position === 'top') top = targetRect.top - (isMobile ? 150 : 200);
                        else if (step.position === 'bottom') top = targetRect.bottom + (isMobile ? 30 : 50);
                        else top = targetRect.top + targetRect.height / 2;
                        
                        // Boundary check
                        const cardHeight = 200;
                        if (top < (isMobile ? 50 : 20)) top = isMobile ? 50 : 20;
                        if (top + cardHeight > window.innerHeight - (isMobile ? 50 : 20)) top = window.innerHeight - cardHeight - (isMobile ? 50 : 20);
                        return top + 'px';
                    })(),
                    transform: (() => {
                        const isMobile = window.innerWidth < 768;
                        if (isMobile) return 'translateX(-50%)'; // Horizontal center, vertical as is
                        return step.position === 'center' ? 'translate(-50%, -50%)' :
                            step.position === 'top' || step.position === 'bottom' ? 'translateX(-50%)' :
                                'translateY(-50%)';
                    })()
                }}
            >
                <div className="relative pointer-events-auto group">
                    {/* Hologram Projector Beam Effect */}
                    <div className="absolute -inset-4 bg-cyan-500/10 blur-xl rounded-[100%] opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="bg-slate-900/90 border border-cyan-500/50 p-4 sm:p-6 min-w-[280px] sm:min-w-[320px] max-w-sm sm:max-w-md skew-x-[-6deg] shadow-[0_0_30px_rgba(6,182,212,0.2)] backdrop-blur-md relative overflow-hidden animate-fade-in-up z-[50]">
                        {/* Scanline */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50" />
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-400/50 animate-scanline" />

                        <div className="skew-x-[6deg] relative z-10">
                            <div className="flex justify-between items-center mb-4 border-b border-cyan-500/30 pb-2">
                                <span className="text-cyan-400 font-black italic tracking-widest text-xs flex items-center gap-2">
                                    <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                                    教學 {currentStep + 1}/{STEPS.length}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSkip(); }}
                                    className="text-slate-500 hover:text-white text-[10px] font-mono border border-slate-600 px-2 py-0.5 hover:bg-slate-700 transition-colors"
                                >
                                    終止
                                </button>
                            </div>

                            <h3 className="text-2xl font-black italic text-white mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-300">
                                {step.text}
                            </h3>

                            {step.subtext && (
                                <p className="text-cyan-200/80 font-mono text-xs leading-relaxed whitespace-pre-line mb-4 border-l-2 border-cyan-500/50 pl-3">
                                    {step.subtext}
                                </p>
                            )}

                            <div className="mt-4 flex justify-end">
                                <div className="text-[10px] text-cyan-500 animate-pulse font-mono tracking-widest">
                                    點擊繼續 {'>'}{'>'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500 opacity-50" />
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500 opacity-50" />
                </div>
            </div>
        </div>
    );
};
