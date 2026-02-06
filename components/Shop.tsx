
import React from 'react';
import { UpgradeStats, EquipmentId } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ShopProps {
  money: number;
  diamonds: number;
  upgrades: UpgradeStats;
  buyUpgrade: (type: keyof UpgradeStats, cost: number) => void;
  onNextLevel: () => void;
  ownedItems: EquipmentId[];
  equippedItem: EquipmentId;
  buyItem: (item: EquipmentId, cost: number) => void;
  equipItem: (item: EquipmentId) => void;
  onExchangeDiamond: () => void;
  onSave?: () => void;
}

export const Shop: React.FC<ShopProps> = ({ money, diamonds, upgrades, buyUpgrade, onNextLevel, ownedItems, equippedItem, buyItem, equipItem, onExchangeDiamond, onSave }) => {
  const getCost = (level: number) => Math.floor(50 * Math.pow(1.5, level));

  const upgradesList = [
    { key: 'engineLevel', name: 'Neuro Thrusters', sub: '推進器', desc: 'Increases thrust power.', info: '提升推動力，飛得更快，但更難控制。' },
    { key: 'tankLevel', name: 'Copium Tank', sub: '燃料箱', desc: 'Max fuel capacity.', info: '增加最大燃料上限，減少斷油危機。' },
    { key: 'hullLevel', name: 'Turtle Shell', sub: '機體裝甲', desc: 'Max health points.', info: '增加無人機生命值，能承受更多撞擊。' },
    { key: 'cargoLevel', name: 'Cargo Cage', sub: '貨物保護', desc: 'Cargo durability.', info: '保護你的蘭姆酒不被撞碎。' },
    { key: 'cableLevel', name: 'Elastic Rope', sub: '彈性繩', desc: 'Physics damping.', info: '減少繩索拉扯對無人機的影響。' },
  ];

  const equipmentList = [
    { id: 'MAGNET', name: 'MAGNET CORE', sub: '磁力核心', cost: 300, desc: 'Auto-collect coins.', info: '自動吸取周圍的金幣。' },
    { id: 'ARMOR', name: 'SHOCK ABSORBER', sub: '避震系統', cost: 500, desc: '-30% Collision Dmg.', info: '減少 30% 撞擊傷害。' },
    { id: 'ECO_CHIP', name: 'ECO CHIP', sub: '節能晶片', cost: 400, desc: '-20% Fuel Usage.', info: '減少 20% 燃料消耗。' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-start bg-slate-950/85 backdrop-blur-sm text-white overflow-hidden font-sans select-none pt-20 pb-4">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#020617_90%)]" />

      {/* Header */}
      <div className="relative z-10 w-full max-w-6xl px-8 flex justify-between items-end mb-8 border-b-2 border-cyan-500/30 pb-4">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            WORKSHOP <span className="text-cyan-500">//</span> DOCK
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-24 bg-cyan-500/50 skew-x-[-12deg]" />
            <span className="text-xs font-mono text-cyan-400 tracking-[0.3em]">SYSTEM UPGRADES & OUTFITTING</span>
          </div>
        </div>

        {/* Currency Display */}
        <div className="flex gap-4">
          {/* Money */}
          <div className="bg-slate-900/80 border-l-4 border-yellow-500 px-6 py-2 skew-x-[-12deg] shadow-[0_0_20px_rgba(234,179,8,0.2)]">
            <div className="skew-x-[12deg] text-right leading-none">
              <div className="text-[10px] text-yellow-500 font-bold tracking-widest mb-1">CREDITS</div>
              <div className="text-3xl font-black italic text-white font-mono">${money.toLocaleString()}</div>
            </div>
          </div>
          {/* Diamonds */}
          <div className="bg-slate-900/80 border-r-4 border-cyan-500 px-6 py-2 skew-x-[-12deg] shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <div className="skew-x-[12deg] text-left leading-none">
              <div className="text-[10px] text-cyan-400 font-bold tracking-widest mb-1">E-DIAMONDS</div>
              <div className="text-3xl font-black italic text-white font-mono flex items-center gap-2">
                <span>💎</span>{diamonds}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-6xl px-8 flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">

        {/* LEFT COLUMN: UPGRADES (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Diamond Exchange Banner */}
          <div className="w-full bg-slate-900/60 border border-cyan-500/30 p-4 rounded relative overflow-hidden group">
            <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-800 rounded flex items-center justify-center text-2xl border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse-slow">💎</div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    EXCHANGE PROTOCOL <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded font-mono">RATE: 1000:1</span>
                  </h3>
                  <p className="text-slate-400 text-sm">Convert loose Credits into permanent E-Diamonds.</p>
                </div>
              </div>
              <button
                onClick={onExchangeDiamond}
                disabled={money < 1000}
                className={`skew-x-[-12deg] px-6 py-2 font-bold transition-all active:scale-95 ${money >= 1000 ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              >
                <span className="skew-x-[12deg] inline-block">EXCHANGE // $1000</span>
              </button>
            </div>
          </div>

          {/* Upgrades Grid */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-green-500 block skew-x-[-12deg]" />
              DRONE MODULES
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upgradesList.map((item) => {
                const level = upgrades[item.key as keyof UpgradeStats];
                const cost = getCost(level);
                const canAfford = money >= cost;

                return (
                  <div key={item.key} className="bg-slate-900/60 border border-slate-700 hover:border-green-500/50 p-4 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-50 font-mono text-xs text-slate-500">MK.{level}</div>

                    <h3 className="text-lg font-bold text-green-400 mb-1 flex items-center gap-2">
                      {item.name}
                      <InfoTooltip text={item.info} />
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mb-2 uppercase tracking-wider">{item.sub}</div>
                    <p className="text-slate-300 text-sm mb-4 h-10">{item.desc}</p>

                    <div className="flex justify-between items-end mt-auto">
                      <div className="text-xs text-slate-500">NEXT: ${cost}</div>
                      <button
                        onClick={() => buyUpgrade(item.key as keyof UpgradeStats, cost)}
                        disabled={!canAfford}
                        className={`skew-x-[-12deg] px-6 py-1.5 font-bold text-sm transition-all active:scale-95 ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                      >
                        <span className="skew-x-[12deg] inline-block">UPGRADE</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: EQUIPMENT & ACTIONS (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-8 h-full">

          {/* Equipment */}
          <div className="bg-slate-900/40 p-6 border-l-2 border-slate-700 h-full flex flex-col">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-orange-500 block skew-x-[-12deg]" />
              SPECIAL GEAR
            </h2>

            <div className="flex flex-col gap-4 flex-1">
              {equipmentList.map((item) => {
                const owned = ownedItems.includes(item.id as EquipmentId);
                const equipped = equippedItem === item.id;
                const canAfford = money >= item.cost;

                return (
                  <div key={item.id} className={`p-4 border transition-all ${equipped ? 'bg-slate-800 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-slate-900/60 border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-orange-400 text-sm flex items-center gap-2">
                          {item.name}
                          <InfoTooltip text={item.info} />
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">{item.sub}</div>
                      </div>
                      {equipped && <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                    </div>

                    <div className="text-xs text-slate-300 mb-3">{item.desc}</div>

                    {owned ? (
                      <button
                        onClick={() => equipItem(item.id as EquipmentId)}
                        disabled={equipped}
                        className={`w-full py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${equipped ? 'bg-orange-600/20 text-orange-400 cursor-default border border-orange-500/50' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                      >
                        {equipped ? ':: ACTIVE ::' : 'EQUIP'}
                      </button>
                    ) : (
                      <button
                        onClick={() => buyItem(item.id as EquipmentId, item.cost)}
                        disabled={!canAfford}
                        className={`w-full py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                      >
                        BUY ${item.cost}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Empty Slot */}
              <div className="mt-auto pt-4 border-t border-slate-700 content-end">
                <button
                  onClick={() => equipItem('NONE')}
                  disabled={equippedItem === 'NONE'}
                  className={`w-full py-2 text-xs font-bold uppercase tracking-wider transition-all ${equippedItem === 'NONE' ? 'bg-slate-800 text-slate-500 cursor-default' : 'bg-slate-700 hover:bg-red-500/20 hover:text-red-400 text-slate-400'}`}
                >
                  UNEQUIP ALL
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Footer Actions */}
      <div className="absolute bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur border-t border-slate-700 p-4 flex justify-between items-center z-20 px-8">
        <div className="text-xs text-slate-500 font-mono">
          NEURO-CORP DRONE SERVICE // TERMINAL_ID_883
        </div>
        <button
          onClick={() => {
            if (onSave) onSave();
            onNextLevel();
          }}
          className="group relative px-8 py-3 bg-white text-black font-black italic tracking-wider hover:bg-cyan-400 transition-colors skew-x-[-12deg]"
        >
          <div className="absolute inset-0 border-2 border-white group-hover:border-cyan-400 translate-x-1 translate-y-1 transition-transform group-hover:translate-x-1.5 group-hover:translate-y-1.5" />
          <span className="skew-x-[12deg] inline-block flex items-center gap-2">
            LEAVE DOCK <span className="text-lg">→</span>
          </span>
        </button>
      </div>
    </div>
  );
};
