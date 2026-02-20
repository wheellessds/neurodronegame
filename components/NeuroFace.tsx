import React from 'react';
import { Persona } from '../types';

// Neuro Images
import neuroIdle from '../assets/face/neuro_idle.gif';
import neuroPanic from '../assets/face/neuro_panic.gif';
import neuroWin from '../assets/face/neuro_win.jpg';
import neuroDead from '../assets/face/neuro_dead.gif';

// Evil Images
import evilIdle from '../assets/face/evil_idle.jpg';
import evilPanic from '../assets/face/evil_panic.gif';
import evilWin from '../assets/face/evil_win.png';
import evilDead from '../assets/face/evil_dead.jpg';

// Vedal Image
import vedalPortrait from '../assets/conceptart/Vedal.webp';

interface NeuroFaceProps {
  status: 'idle' | 'panic' | 'dead' | 'win' | 'fast';
  persona: Persona;
  className?: string;
}

export const NeuroFace: React.FC<NeuroFaceProps> = ({ status, persona, className = '' }) => {
  const isEvil = persona === Persona.EVIL;
  const [loadError, setLoadError] = React.useState(false);

  // 當圖片路徑改變時，重置錯誤狀態
  React.useEffect(() => {
    setLoadError(false);
  }, [status, persona]);

  // Mapping status to images
  const getAvatarSrc = () => {
    if (isEvil) {
      switch (status) {
        case 'panic': return evilPanic;
        case 'dead': return evilDead;
        case 'win': return evilWin;
        case 'fast': return evilWin; // 高速時顯示興奮/臉紅
        default: return evilIdle;
      }
    } else if (persona === Persona.VEDAL) {
      return vedalPortrait; // 目前 Vedal 只有一張圖
    } else {
      switch (status) {
        case 'panic': return neuroPanic;
        case 'dead': return neuroDead;
        case 'win': return neuroWin;
        case 'fast': return neuroWin; // 高速時顯示探頭
        default: return neuroIdle;
      }
    }
  };

  const avatarImg = getAvatarSrc();
  const isVedal = persona === Persona.VEDAL;
  const borderColor = isEvil ? 'border-red-600' : (isVedal ? 'border-green-600' : 'border-pink-400');

  // 根據狀態選擇動畫
  const getAnimationClass = () => {
    switch (status) {
      case 'idle':
        return 'animate-[avatar-float_3s_ease-in-out_infinite]';
      case 'panic':
        return 'animate-[avatar-shake_0.3s_ease-in-out_infinite]';
      case 'win':
        return 'animate-[avatar-glow_1.5s_ease-in-out_infinite]';
      case 'fast':
        return 'animate-[avatar-pulse-fast_0.5s_ease-in-out_infinite]';
      case 'dead':
        return 'animate-[avatar-fade_2s_ease-in-out_infinite]';
      default:
        return '';
    }
  };

  return (
    <div className={`relative w-24 h-24 border-4 ${borderColor} rounded-xl overflow-hidden shadow-lg transition-all duration-300 bg-slate-900 ${getAnimationClass()} ${className}`}>
      {/* 背景層 (Z-0) */}
      <div className={`absolute inset-0 z-0 ${isEvil ? 'bg-red-950' : (isVedal ? 'bg-green-950' : 'bg-pink-100')}`} />

      {/* 頭像圖片層 (Z-10) */}
      {!loadError ? (
        <img
          key={`${persona}-${status}`}
          src={avatarImg}
          alt={persona}
          onError={() => setLoadError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 z-10 ${status === 'panic' ? 'scale-110' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-800 text-white/50 text-[10px] text-center p-2">
          Image Load failed
        </div>
      )}

      {/* 角色標籤 (Z-30) */}
      <div className={`absolute bottom-1 right-1 px-1 rounded text-[10px] font-bold z-30 ${isEvil ? 'bg-red-600 text-white' : (isVedal ? 'bg-green-600 text-white' : 'bg-pink-400 text-white')}`}>
        {isVedal ? 'VEDAL' : (isEvil ? 'EVIL' : 'NEURO')}
      </div>
    </div>
  );
};
