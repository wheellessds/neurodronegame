import React from 'react';
import { Persona, EquipmentId } from '../types';

interface DroneViewProps {
    color: string;
    persona: Persona;
    isMobile?: boolean;
    angle?: number;
    thrustPower?: number;
    isInvincible?: boolean;
    isGodMode?: boolean;
    equippedItem?: EquipmentId | null;
    health?: number;
    isDead?: boolean;
    showSpeedLines?: boolean;
    className?: string; // Add className prop for additional styling
    forceThrustVisual?: boolean; // Allow forcing flame render for CSS control
    fixedSize?: boolean; // If true, renders at a consistent high-res size (approx 256px base) for scaling
    showGlow?: boolean; // Toggle body glow effect
    isBursting?: boolean; // New prop for high-speed "full effects"
}

export const DroneView: React.FC<DroneViewProps> = ({
    color,
    persona,
    isMobile,
    angle = 0,
    thrustPower = 0,
    isInvincible = false,
    isGodMode = false,
    equippedItem,
    health = 100,
    isDead = false,
    showSpeedLines = false,
    className = "",
    forceThrustVisual = false,
    fixedSize = false,
    showGlow = false, // Default to false as requested
    isBursting = false
}) => {
    // Determine visual states
    const isInFlight = thrustPower > 0 || forceThrustVisual;
    const isEvil = persona === Persona.EVIL;

    // Death state overrides color
    const displayColor = isDead ? '#64748b' : (isGodMode ? '#f59e0b' : color);
    const glowColor = isGodMode ? '#fbbf24' : displayColor;

    // Sizing Logic
    // If fixedSize is true, use solid large classes (equivalent to lg/xl).
    // Otherwise use responsive classes.
    const containerSize = fixedSize ? 'w-64 h-64' : (isMobile ? 'w-24 h-24' : 'w-32 h-32 md:w-48 md:h-48 lg:w-64 lg:h-64');
    const bodySize = fixedSize ? 'w-24 h-24' : (isMobile ? 'w-12 h-12' : 'w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24');
    const eyeWrapperMount = fixedSize ? '-mt-4' : (isMobile ? '-mt-1.5' : '-mt-1.5 md:-mt-4');
    const eyeSize = fixedSize ? 'w-5 h-5' : (isMobile ? 'w-3 h-3' : 'w-3 h-3 md:w-5 md:h-5');
    const eyeGap = fixedSize ? 'gap-3' : (isMobile ? 'gap-1' : 'gap-1 md:gap-3');

    return (
        <div className={`relative ${containerSize} flex items-center justify-center ${className}`}>
            {/* Drone Body */}
            <div
                className={`${bodySize} rounded-full relative z-10 flex items-center justify-center transition-all duration-300
                    ${(showGlow || isBursting) ? 'shadow-[0_0_40px_rgba(0,0,0,0.7)]' : ''}
                    ${isBursting ? 'brightness-125' : ''}
                    ${isDead ? 'grayscale brightness-50' : ''}`}
                style={{
                    backgroundColor: displayColor,
                    transform: `rotate(${angle}rad)`
                }}
            >
                {/* Eyes */}
                <div className={`flex ${eyeGap} ${eyeWrapperMount} relative z-20`}>
                    <div className={`${eyeSize} rounded-sm shadow-[0_0_8px_white] transition-colors duration-300 ${isDead ? 'bg-slate-400' : 'bg-white'} ${!isBursting ? 'animate-blink' : ''}`} />
                    <div className={`${eyeSize} rounded-sm shadow-[0_0_8px_white] transition-colors duration-300 ${isDead ? 'bg-slate-400' : 'bg-white'} ${!isBursting ? 'animate-blink' : ''}`} />
                </div>

                {/* Glow */}
                {!isDead && (showGlow || isBursting) && (
                    <>
                        <div className={`absolute inset-0 rounded-full blur-lg md:blur-xl ${isBursting ? 'opacity-40' : 'opacity-30'} animate-pulse`} style={{ backgroundColor: glowColor }} />
                        {isBursting && (
                            <div className="absolute -inset-1 rounded-full blur-lg opacity-15 animate-pulse" style={{ backgroundColor: glowColor, animationDuration: '0.8s' }} />
                        )}
                    </>
                )}

                {/* Invincibility Shield Effect */}
                {isInvincible && !isDead && (
                    <div className="absolute inset-0 -m-2 rounded-full border-4 border-cyan-400 opacity-60 animate-ping" />
                )}

                {/* Equipment Visuals */}
                {equippedItem === 'MAGNET' && !isDead && (
                    <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-pulse opacity-80" />
                )}
            </div>

            {/* Rotors - 3D style (rotateY) */}
            {/* We rotate the container to match drone angle, but rotors spin independently in local space if needed, 
                however, since we rotate the whole body div above, we should place rotors carefuly. 
                Wait, the original design rotates the whole container 'animate-fly'. 
                In game, we rotate the PARENT container via ref. 
                So here we should NOT rotate the internal parts based on prop 'angle' if the parent is rotated?
                Actually, for GameCanvas usage, we pass angle=0 to this component usually, 
                and rotate the div in GameCanvas.
                OR we pass angle here and rotate internal elements? 
                
                Let's stick to the props: 'angle' prop is passed. 
                In CharacterSelect, 'angle' is driven by CSS animation.
                In GameCanvas, 'angle' is real physics angle.
                
                The 'style={{ transform: rotate(angle) }}' above rotates the BODY. 
                But the THRUST and ROTORS are siblings in the original CSS.
                Let's structure it so everything rotates together if we apply rotation to a wrapper,
                or we apply rotation to each part.
                
                For GameCanvas, the overlay DIV is rotated. So internal components should have angle=0 relative to that div.
                So 'angle' prop might be redundant if we handle rotation upsteam?
                
                Actually, let's keep it flexible. If 'angle' is provided, we rotate the contents.
            */}

            {/* Rotors Wrapper - Rotates with drone */}
            <div
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
                style={{ transform: `rotate(${angle}rad)` }}
            >
                {/* CSS High-Speed Effects (RGB Trails & Flow) */}
                {isBursting && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        {/* Directional Flow Ribbons (往右上飛) */}
                        <div className="absolute w-64 h-2 bg-gradient-to-l from-white/40 via-cyan-400/20 to-transparent rotate-45 -translate-x-12 translate-y-12 blur-sm animate-ribbon-flow" />
                        <div className="absolute w-48 h-1 bg-gradient-to-l from-white/30 via-pink-400/10 to-transparent rotate-45 -translate-x-8 translate-y-8 blur-[1px] animate-ribbon-flow" style={{ animationDelay: '-0.3s' }} />

                        {/* Persona-Specific Particles */}
                        <div className="absolute inset-0 pointer-events-none overflow-visible">
                            {persona === 'NEURO' ? (
                                <>
                                    <div className="absolute text-[12px] text-cyan-400 font-mono animate-float-code" style={{ top: '30%', left: '25%' }}>0</div>
                                    <div className="absolute text-[14px] text-cyan-300 font-mono animate-float-code" style={{ top: '50%', left: '15%', animationDelay: '0.4s' }}>1</div>
                                    <div className="absolute text-[10px] text-white font-mono animate-float-code" style={{ top: '70%', left: '35%', animationDelay: '0.8s' }}>0</div>
                                </>
                            ) : (
                                <>
                                    <div className="absolute w-2.5 h-2.5 bg-red-600 rounded-full blur-[1px] animate-float-ember" style={{ top: '30%', left: '25%' }} />
                                    <div className="absolute w-2 h-2 bg-orange-500 rounded-full blur-[0.5px] animate-float-ember" style={{ top: '50%', left: '15%', animationDelay: '0.3s' }} />
                                    <div className="absolute w-1.5 h-1.5 bg-yellow-400 rounded-full blur-[0.5px] animate-float-ember" style={{ top: '70%', left: '35%', animationDelay: '0.6s' }} />
                                </>
                            )}
                        </div>

                        {/* RGB Ghosting Layers - More subtle */}
                        <div className="absolute inset-0 rounded-full bg-red-500/15 blur-sm -translate-x-3 translate-y-3 scale-95 mix-blend-screen opacity-50 animate-ghost-pulse" />
                        <div className="absolute inset-0 rounded-full bg-cyan-400/15 blur-sm -translate-x-6 translate-y-6 scale-90 mix-blend-screen opacity-30 animate-ghost-pulse" style={{ animationDelay: '-0.2s' }} />
                        <div className="absolute inset-0 rounded-full opacity-10 bg-white blur-lg animate-pulse scale-110" />
                    </div>
                )}

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[4%] flex justify-between px-2">
                    <div className={`w-[42%] h-full bg-slate-600 rounded-full origin-center ${!isDead ? 'animate-spin-fast' : ''}`} />
                    <div className={`w-[42%] h-full bg-slate-600 rounded-full origin-center ${!isDead ? 'animate-spin-fast' : ''}`} />
                </div>

                {/* Rotor Center Glow Dots */}
                {!isDead && (
                    <>
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full animate-pulse" style={{
                            left: '8%',
                            width: isBursting ? '8px' : '5px',
                            height: isBursting ? '8px' : '5px',
                            backgroundColor: isEvil ? '#ef4444' : '#22d3ee',
                            boxShadow: `0 0 ${isBursting ? '12px 4px' : '6px 2px'} ${isEvil ? '#ef4444' : '#22d3ee'}`,
                            transition: 'all 0.3s'
                        }} />
                        <div className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full animate-pulse" style={{
                            right: '8%',
                            width: isBursting ? '8px' : '5px',
                            height: isBursting ? '8px' : '5px',
                            backgroundColor: isEvil ? '#ef4444' : '#22d3ee',
                            boxShadow: `0 0 ${isBursting ? '12px 4px' : '6px 2px'} ${isEvil ? '#ef4444' : '#22d3ee'}`,
                            transition: 'all 0.3s'
                        }} />
                    </>
                )}

                {/* Thrust Flame */}
                {isInFlight && !isDead && (
                    <div className={`absolute top-[65%] left-1/2 -translate-x-1/2 w-6 md:w-10 blur-md animate-thrust origin-top ${isBursting ? 'brightness-150' : ''}`}
                        style={{
                            height: `calc(var(--thrust-scale, ${thrustPower}) * ${isBursting ? '120px' : '80px'})`, // Dynamic height based on thrust
                            opacity: `calc(var(--thrust-scale, ${thrustPower}) + 0.2)`, // Fade out at low thrust
                            background: isEvil
                                ? 'linear-gradient(to bottom, transparent, #ef4444, #fee2e2)'
                                : 'linear-gradient(to bottom, transparent, #22d3ee, #ffffff)'
                        }}
                    >
                        {isBursting && (
                            <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
                        )}
                    </div>
                )}
            </div>

            {/* Speed Lines Effect (Enhanced for 45deg direction) */}
            {showSpeedLines && !isDead && (
                <div className={`absolute inset-0 pointer-events-none overflow-hidden ${isBursting ? 'opacity-100' : 'opacity-40'} transition-opacity duration-1000`}>
                    <div className="absolute top-0 right-0 w-64 h-0.5 bg-white/40 rotate-45 animate-speed-line-diagonal" style={{ animationDelay: '0s', top: '10%', right: '-10%' }} />
                    <div className="absolute top-1/2 right-1/4 w-96 h-1 bg-white/20 rotate-45 animate-speed-line-diagonal" style={{ animationDelay: '0.4s', top: '30%', right: '10%' }} />
                    <div className="absolute top-3/4 right-0 w-80 h-0.5 bg-white/30 rotate-45 animate-speed-line-diagonal" style={{ animationDelay: '0.8s', top: '50%', right: '-20%' }} />
                    {isBursting && (
                        <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    )}
                </div>
            )}

            {/* Base shadow (Only if not rotated/flying high? In game we might not want this static shadow if we have dynamic shadows... 
               But CharacterSelect has it. Let's keep it but maybe optional or subtle.) 
               Actually for GameCanvas, the shadow usually is far below. 
               This 'base shadow' is part of the 'preview'. 
               Let's hide it if we are in 'game mode' (implied by angle usage? or custom prop?)
               Let's keep it simple: If angle is 0 (UI mode usually), show it. If angle changes, maybe hide?
               Actually, let's keep it for UI, but for GameOverlay we might want to hide it as it doesn't make sense to rotat with drone.
            */}
            {/* Base shadow - Only show in Menu Mode (implied by showGlow) */}
            {angle === 0 && !isDead && showGlow && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 md:w-36 h-4 md:h-8 bg-black/40 rounded-[100%] blur-xl md:blur-2xl" />
            )}

            <style>{`
                @keyframes hero-fly {
                    0% { transform: translate(0, 0) rotate(45deg) scale(1); }
                    25% { transform: translate(5%, -5%) rotate(42deg) scale(1.02); }
                    50% { transform: translate(2%, -10%) rotate(48deg) scale(1); }
                    75% { transform: translate(8%, -8%) rotate(44deg) scale(0.98); }
                    85% { transform: translate(6%, -6%) rotate(45deg) scale(1); }
                    94% { transform: translate(6%, -6%) rotate(405deg) scale(1.1); filter: brightness(1.2); }
                    100% { transform: translate(0, 0) rotate(405deg) scale(1); }
                }
                 /* Reuse other keyframes from CharacterSelectOverlay if needed globally or duplicate here scoped */
                @keyframes blink {
                    0%, 92%, 96%, 100% { transform: scaleY(1); }
                    94% { transform: scaleY(0.08); }
                }
                @keyframes spin-fast {
                    from { transform: rotateY(0deg); }
                    to { transform: rotateY(360deg); }
                }
                @keyframes thrust {
                    0%, 100% { opacity: 0.8; transform: translateX(-50%) scaleX(1); }
                    50% { opacity: 1; transform: translateX(-50%) scaleX(1.1); }
                }
                @keyframes speed-line-diagonal {
                    0% { transform: translate(150%, -150%) rotate(45deg) scaleX(0.1); opacity: 0; }
                    50% { transform: translate(0, 0) rotate(45deg) scaleX(2); opacity: 0.9; }
                    100% { transform: translate(-150%, 150%) rotate(45deg) scaleX(0.1); opacity: 0; }
                }
                @keyframes ribbon-flow {
                    0% { transform: translate(60%, -60%) rotate(45deg) scaleY(0.5); opacity: 0; }
                    50% { transform: translate(0, 0) rotate(45deg) scaleY(1.2); opacity: 0.8; }
                    100% { transform: translate(-60%, 60%) rotate(45deg) scaleY(0.5); opacity: 0; }
                }
                @keyframes ghost-pulse {
                    0%, 100% { transform: translate(-4px, 4px) scale(0.95); opacity: 0.4; }
                    50% { transform: translate(-12px, 12px) scale(0.9); opacity: 0.7; }
                }
                @keyframes float-code {
                    0% { transform: translate(30px, -30px) scale(0.5); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translate(-120px, 120px) scale(1.5); opacity: 0; }
                }
                @keyframes float-ember {
                    0% { transform: translate(20px, -20px) scale(0.5); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translate(-150px, 150px) scale(0.2); opacity: 0; }
                }
                .animate-fly { animation: hero-fly 4s ease-in-out infinite; }
                .animate-speed-line-diagonal { animation: speed-line-diagonal 0.5s linear infinite; }
                .animate-ribbon-flow { animation: ribbon-flow 0.4s ease-out infinite; }
                .animate-ghost-pulse { animation: ghost-pulse 0.2s ease-in-out infinite; }
                .animate-float-code { animation: float-code 1s linear infinite; }
                .animate-float-ember { animation: float-ember 0.8s ease-out infinite; }
                .animate-blink { animation: blink 3.5s ease-in-out infinite; }
                .animate-spin-fast { animation: spin-fast 0.1s linear infinite; }
                .animate-thrust { animation: thrust 0.08s ease-in-out infinite; }
            `}</style>
        </div>
    );
};
