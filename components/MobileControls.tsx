
import React, { useRef, useCallback, useState } from 'react';
import { MobileLayout, MobileButtonPos } from '../types';

interface MobileControlsProps {
  difficulty: 'NORMAL' | 'EASY';
  layout: MobileLayout;
  isEditing: boolean;
  onUpdateLayout: (newLayout: MobileLayout) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  difficulty,
  layout,
  isEditing,
  onUpdateLayout
}) => {
  const dragTargetRef = useRef<keyof MobileLayout | null>(null);

  const handleAction = useCallback((key: string, start: boolean) => {
    if (isEditing) return; // Block actions in edit mode
    const event = new KeyboardEvent(start ? 'keydown' : 'keyup', {
      key,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  }, [isEditing]);

  const preventDefault = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (e.cancelable) e.preventDefault();
  }, []);

  const handleTouchStart = (e: React.TouchEvent, button: keyof MobileLayout) => {
    if (!isEditing) return;
    dragTargetRef.current = button;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isEditing || !dragTargetRef.current) return;
    const touch = e.touches[0];
    const button = dragTargetRef.current;

    const xPercent = (touch.clientX / window.innerWidth) * 100;
    const yPercent = (1 - touch.clientY / window.innerHeight) * 100;

    const newPos: MobileButtonPos = {
      x: (button === 'thrust' || button === 'joystick') ? xPercent : (100 - xPercent),
      y: yPercent
    };

    onUpdateLayout({
      ...layout,
      [button]: newPos
    });
  };

  const handleTouchEnd = () => {
    dragTargetRef.current = null;
  };

  const [joystickThumb, setJoystickThumb] = useState({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement>(null);

  const handleJoystickMove = (e: React.TouchEvent) => {
    if (isEditing || !joystickBaseRef.current) return;
    const touch = e.touches[0];
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;

    if (dist > maxRadius) {
      dx *= maxRadius / dist;
      dy *= maxRadius / dist;
    }

    setJoystickThumb({ x: dx, y: dy });

    window.dispatchEvent(new CustomEvent('joystick-input', {
      detail: { x: dx / maxRadius, y: dy / maxRadius, active: true }
    }));
  };

  const handleJoystickEnd = () => {
    if (isEditing) {
      dragTargetRef.current = null;
      return;
    }
    setJoystickThumb({ x: 0, y: 0 });
    window.dispatchEvent(new CustomEvent('joystick-input', {
      detail: { x: 0, y: 0, active: false }
    }));
  };

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-[100] select-none touch-none ${isEditing ? 'bg-pink-500/10' : ''}`}
      onTouchMove={(e) => {
        if (isEditing) handleTouchMove(e);
        else if (difficulty === 'EASY' && joystickBaseRef.current) handleJoystickMove(e);
      }}
      onTouchEnd={() => {
        if (isEditing) handleTouchEnd();
        else if (difficulty === 'EASY') handleJoystickEnd();
      }}
    >
      {difficulty === 'NORMAL' ? (
        <>
          {/* Thrust Button */}
          <div
            className={`absolute w-32 h-32 flex flex-col items-center justify-center pointer-events-auto rounded-full shadow-lg backdrop-blur-sm border-4 transition-all
              ${isEditing ? 'border-dashed border-pink-400 bg-pink-500/30 scale-110 cursor-move' : 'border-pink-400/40 bg-pink-500/20 active:bg-pink-500/60'}`}
            style={{
              left: `${layout.thrust.x}%`,
              bottom: `${layout.thrust.y}%`,
              transform: 'translate(-50%, 50%)',
              touchAction: 'none'
            }}
            onTouchStart={(e) => {
              if (isEditing) handleTouchStart(e, 'thrust');
              else { preventDefault(e); handleAction('w', true); }
            }}
            onTouchEnd={(e) => { if (!isEditing) { preventDefault(e); handleAction('w', false); } }}
          >
            <span className="text-4xl text-pink-300">▲</span>
            <span className="text-xs font-bold text-white mt-1">THRUST</span>
            {isEditing && <div className="absolute -top-6 bg-pink-600 text-[10px] px-2 rounded">DRAG</div>}
          </div>

          <div className="absolute inset-0 pointer-events-none">
            {/* Left Button */}
            <div
              className={`absolute w-24 h-24 flex flex-col items-center justify-center pointer-events-auto rounded-2xl shadow-lg backdrop-blur-sm border-4 transition-all
                  ${isEditing ? 'border-dashed border-cyan-400 bg-cyan-500/30 scale-110 cursor-move' : 'border-cyan-400/40 bg-cyan-500/20 active:bg-cyan-500/60'}`}
              style={{
                right: `${layout.left.x}%`,
                bottom: `${layout.left.y}%`,
                transform: 'translate(50%, 50%)',
                touchAction: 'none'
              }}
              onTouchStart={(e) => {
                if (isEditing) handleTouchStart(e, 'left');
                else { preventDefault(e); handleAction('a', true); }
              }}
              onTouchEnd={(e) => { if (!isEditing) { preventDefault(e); handleAction('a', false); } }}
            >
              <span className="text-4xl text-white font-bold leading-none">←</span>
              {isEditing && <div className="absolute -top-6 bg-cyan-600 text-[10px] px-2 rounded">DRAG</div>}
            </div>

            {/* Right Button */}
            <div
              className={`absolute w-24 h-24 flex flex-col items-center justify-center pointer-events-auto rounded-2xl shadow-lg backdrop-blur-sm border-4 transition-all
                  ${isEditing ? 'border-dashed border-cyan-400 bg-cyan-500/30 scale-110 cursor-move' : 'border-cyan-400/40 bg-cyan-500/20 active:bg-cyan-500/60'}`}
              style={{
                right: `${layout.right.x}%`,
                bottom: `${layout.right.y}%`,
                transform: 'translate(50%, 50%)',
                touchAction: 'none'
              }}
              onTouchStart={(e) => {
                if (isEditing) handleTouchStart(e, 'right');
                else { preventDefault(e); handleAction('d', true); }
              }}
              onTouchEnd={(e) => { if (!isEditing) { preventDefault(e); handleAction('d', false); } }}
            >
              <span className="text-4xl text-white font-bold leading-none">→</span>
              {isEditing && <div className="absolute -top-6 bg-cyan-600 text-[10px] px-2 rounded">DRAG</div>}
            </div>
          </div>
        </>
      ) : (
        /* Easy Mode Joystick */
        <div
          ref={joystickBaseRef}
          className={`absolute w-40 h-40 flex items-center justify-center pointer-events-auto rounded-full shadow-2xl backdrop-blur-md border-4 transition-all
            ${isEditing ? 'border-dashed border-pink-400 bg-pink-500/30 scale-110 cursor-move' : 'border-white/20 bg-slate-800/40'}`}
          style={{
            left: `${layout.joystick.x}%`,
            bottom: `${layout.joystick.y}%`,
            transform: 'translate(-50%, 50%)',
            touchAction: 'none'
          }}
          onTouchStart={(e) => {
            if (isEditing) handleTouchStart(e, 'joystick');
            else { preventDefault(e); }
          }}
        >
          {/* Outer Ring */}
          <div className="absolute inset-2 border-2 border-white/10 rounded-full" />

          {/* Thumb Stick */}
          <div
            className="w-16 h-16 bg-white/10 rounded-full border-2 border-white/40 shadow-xl flex items-center justify-center transition-transform"
            style={{
              transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`
            }}
          >
            <div className="w-4 h-4 bg-white/20 rounded-full shadow-[0_0_10px_white]" />
          </div>

          {isEditing && <div className="absolute -top-8 bg-pink-600 text-white text-[10px] px-3 py-1 rounded-full font-bold">JOYSTICK DRAG</div>}
        </div>
      )}
    </div>
  );
};
