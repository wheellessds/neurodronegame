
import React from 'react';
import { UpgradeStats, EquipmentId } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface ShopProps {
  money: number;
  upgrades: UpgradeStats;
  buyUpgrade: (type: keyof UpgradeStats, cost: number) => void;
  onNextLevel: () => void;
  ownedItems: EquipmentId[];
  equippedItem: EquipmentId;
  buyItem: (item: EquipmentId, cost: number) => void;
  equipItem: (item: EquipmentId) => void;
  onSave?: () => void;
}

export const Shop: React.FC<ShopProps> = ({ money, upgrades, buyUpgrade, onNextLevel, ownedItems, equippedItem, buyItem, equipItem, onSave }) => {
  const getCost = (level: number) => Math.floor(50 * Math.pow(1.5, level));

  const upgradesList = [
    { key: 'engineLevel', name: 'Neuro Thrusters (推進器)', desc: '增加推力。小心別撞牆！ (Increases thrust)', info: '提升無人機的推動力，能飛得更快，但操作難度也會隨之增加。' },
    { key: 'tankLevel', name: 'Copium Tank (燃料箱)', desc: '攜帶更多燃料以進行長途飛行。 (More fuel)', info: '提升燃料儲存量，讓飛行時間更長，減少斷油機率。' },
    { key: 'hullLevel', name: 'Turtle Shell (機體裝甲)', desc: '增加無人機耐撞度。 (Drone HP)', info: '提高無人機機身的血量，能夠承受更多次輕微碰撞。' },
    { key: 'cargoLevel', name: 'Cargo Cage (貨物保護架)', desc: '增加蘭姆酒的耐撞度。 (Cargo HP)', info: '提高蘭姆酒貨箱的血量，防止脆弱的貨物在碰撞中破碎。' },
    { key: 'cableLevel', name: 'Elastic Rope (彈性繩)', desc: '減少拉扯無人機的力道。 (Dampens force)', info: '使繩索更具彈性，緩衝貨物晃動對無人機造成的物理干擾。' },
  ];

  const equipmentList = [
    { id: 'MAGNET', name: 'Magnet Core (磁力核心)', cost: 300, desc: '增加金幣收集範圍。 (Increased coin range)', info: '磁力自動吸引周圍的金幣，不需要精準路過就能收集。' },
    { id: 'ARMOR', name: 'Shock Absorber (避震系統)', cost: 500, desc: '減少 30% 碰撞傷害。 (Reduce 30% damage)', info: '避震系統可減少碰撞造成的損傷，提高生存率。' },
    { id: 'ECO_CHIP', name: 'Eco Chip (節能晶片)', cost: 400, desc: '減少 20% 燃料消耗。 (Reduce 20% fuel usage)', info: '優化燃料效率，在進行高速推進時消耗更少的油量。' },
  ];

  return (
    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center p-4 md:p-8 text-white z-20 overflow-y-auto">
      <div className="flex flex-col items-center w-full max-w-4xl py-8">
        <h1 className="text-4xl mb-4 font-bold text-purple-400 animate-pulse text-center">對接與改裝工坊</h1>
        <p className="text-xl mb-8 bg-slate-800 px-6 py-2 rounded-full border border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
          持有金額: <span className="text-yellow-400 font-bold">${money}</span>
        </p>

        {/* Basic Upgrades */}
        <h2 className="text-2xl text-cyan-400 font-bold mb-4 self-start border-b border-cyan-500 w-full pb-2">系統升級 (SYSTEM UPGRADES)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full mb-8">
          {upgradesList.map((item) => {
            const level = upgrades[item.key as keyof UpgradeStats];
            const cost = getCost(level);
            const canAfford = money >= cost;

            return (
              <div key={item.key} className="bg-slate-800 p-4 md:p-6 rounded-lg border border-slate-600 shadow-lg flex flex-col justify-between transform transition-all hover:border-pink-500/50">
                <div>
                  <h3 className="text-xl md:text-2xl text-yellow-400 font-bold flex justify-between items-center">
                    <span className="flex items-center">
                      {item.name}
                      <InfoTooltip text={item.info} />
                    </span>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300">Lv {level}</span>
                  </h3>
                  <p className="text-gray-300 my-2 text-sm md:text-base">{item.desc}</p>
                </div>
                <button
                  onClick={() => buyUpgrade(item.key as keyof UpgradeStats, cost)}
                  disabled={!canAfford}
                  className={`mt-4 py-3 px-4 rounded font-bold w-full transition-all active:scale-95 touch-manipulation ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg' : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'}`}
                >
                  升級 (${cost})
                </button>
              </div>
            );
          })}
        </div>

        {/* Equipment */}
        <h2 className="text-2xl text-orange-400 font-bold mb-4 self-start border-b border-orange-500 w-full pb-2">特殊裝備 (SPECIAL EQUIPMENT)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
          {equipmentList.map((item) => {
            const owned = ownedItems.includes(item.id as EquipmentId);
            const equipped = equippedItem === item.id;
            const canAfford = money >= item.cost;

            return (
              <div key={item.id} className={`bg-slate-800 p-4 rounded-lg border ${equipped ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-slate-600'} shadow-lg flex flex-col justify-between`}>
                <div>
                  <h3 className="text-lg text-yellow-400 font-bold flex items-center">
                    {item.name}
                    <InfoTooltip text={item.info} />
                  </h3>
                  <p className="text-gray-400 text-sm my-2">{item.desc}</p>
                </div>
                {owned ? (
                  <button
                    onClick={() => equipItem(item.id as EquipmentId)}
                    disabled={equipped}
                    className={`mt-2 py-2 px-4 rounded font-bold w-full ${equipped ? 'bg-orange-600 text-white cursor-default' : 'bg-slate-600 hover:bg-slate-500 text-white'}`}
                  >
                    {equipped ? '已裝備' : '裝備'}
                  </button>
                ) : (
                  <button
                    onClick={() => buyItem(item.id as EquipmentId, item.cost)}
                    disabled={!canAfford}
                    className={`mt-2 py-2 px-4 rounded font-bold w-full ${canAfford ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                  >
                    購買 (${item.cost})
                  </button>
                )}
              </div>
            );
          })}
          {/* Unequip Option */}
          <div className={`bg-slate-800 p-4 rounded-lg border border-slate-600 shadow-lg flex flex-col justify-between items-center opacity-80`}>
            <h3 className="text-lg text-gray-400 font-bold">無裝備</h3>
            <button onClick={() => equipItem('NONE')} disabled={equippedItem === 'NONE'} className={`mt-auto py-2 px-4 rounded font-bold w-full ${equippedItem === 'NONE' ? 'bg-gray-700 cursor-default' : 'bg-slate-600 hover:bg-slate-500'}`}>
              {equippedItem === 'NONE' ? '啟用' : '卸除'}
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            if (onSave) onSave();
            onNextLevel();
          }}
          className="mt-4 bg-gray-500 hover:bg-gray-400 active:bg-gray-600 text-white text-xl md:text-2xl py-4 px-12 rounded-full font-bold shadow-lg w-full md:w-auto touch-manipulation mb-8"
        >
          返回存檔點 (BACK)
        </button>
      </div>
    </div>
  );
};
