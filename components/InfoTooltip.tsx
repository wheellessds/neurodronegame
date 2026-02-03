import React, { useState } from 'react';

interface InfoTooltipProps {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, position = 'top' }) => {
    const [visible, setVisible] = useState(false);

    const posClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    return (
        <div className="relative inline-block ml-1 group pointer-events-none">
            <div
                className="w-4 h-4 rounded-full border border-white/50 flex items-center justify-center text-[10px] cursor-help hover:bg-white/20 transition-colors pointer-events-auto"
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onClick={(e) => {
                    e.stopPropagation();
                    setVisible(!visible);
                }}
            >
                ?
            </div>
            {(visible) && (
                <div className={`absolute z-[1000] ${posClasses[position]} w-48 p-2 bg-black/90 border border-cyan-500 rounded shadow-xl text-white text-xs leading-relaxed pointer-events-none transition-opacity duration-200 animate-in fade-in zoom-in-95`}>
                    {text}
                    {/* Arrow */}
                    <div className={`absolute w-0 h-0 border-4 ${position === 'top' ? 'border-t-cyan-500 border-l-transparent border-r-transparent border-b-transparent top-full left-1/2 -translate-x-1/2' :
                        position === 'bottom' ? 'border-b-cyan-500 border-l-transparent border-r-transparent border-t-transparent bottom-full left-1/2 -translate-x-1/2' :
                            position === 'left' ? 'border-l-cyan-500 border-t-transparent border-b-transparent border-r-transparent left-full top-1/2 -translate-y-1/2' :
                                'border-r-cyan-500 border-t-transparent border-b-transparent border-l-transparent right-full top-1/2 -translate-y-1/2'
                        }`} />
                </div>
            )}
        </div>
    );
};
