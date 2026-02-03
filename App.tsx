import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Shop } from './components/Shop';
import { UIOverlay } from './components/UIOverlay';
import { MobileControls } from './components/MobileControls';
import { LeaderboardEntry, ControlsConfig, GameState, Persona, UpgradeStats, Vector2, EquipmentId } from './types';
import { INITIAL_MONEY } from './constants';
import { SoundManager } from './utils/audio';
import { NeuroFace } from './components/NeuroFace';
import { Leaderboard } from './components/Leaderboard';
import { SettingsOverlay } from './components/SettingsOverlay';
import { LoadingScreen } from './components/LoadingScreen';
import { preloadAssets } from './utils/assetLoader';
import { MultiplayerManager, RemotePlayer, MultiplayerEvent } from './utils/multiplayer';
import { InfoTooltip } from './components/InfoTooltip';

// Assets to preload
import neuroIdle from './assets/face/neuro_idle.gif';
import neuroPanic from './assets/face/neuro_panic.gif';
import neuroWin from './assets/face/neuro_win.jpg';
import neuroDead from './assets/face/neuro_dead.gif';
import evilIdle from './assets/face/evil_idle.jpg';
import evilPanic from './assets/face/evil_panic.gif';
import evilWin from './assets/face/evil_win.png';
import evilDead from './assets/face/evil_dead.jpg';

const DEFAULT_CONTROLS: ControlsConfig = {
  keys: {
    thrust: 'w',
    left: 'a',
    right: 'd',
    pause: 'Escape'
  },
  mobile: {
    thrust: { x: 10, y: 15 },
    left: { x: 30, y: 15 },
    right: { x: 10, y: 15 },
    joystick: { x: 15, y: 15 }
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOADING);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Neural Networks...');
  const [persona, setPersona] = useState<Persona>(Persona.NEURO);
  const [difficulty, setDifficulty] = useState<'NORMAL' | 'EASY'>('NORMAL');
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [gameKey, setGameKey] = useState(0);
  const [respawnToken, setRespawnToken] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [finalDistance, setFinalDistance] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [pendingScore, setPendingScore] = useState<{ distance: number, time: number, trajectory?: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[] } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [postScoreAction, setPostScoreAction] = useState<'RESTART' | 'MENU' | null>(null);

  const [isMobileMode, setIsMobileMode] = useState(false);
  const [currentSeed, setCurrentSeed] = useState(Math.random().toString(36).substring(2, 9).toUpperCase());
  const [isChallengingSeed, setIsChallengingSeed] = useState(false);
  const [ghostData, setGhostData] = useState<{ trajectory: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[], name: string } | null>(null);
  const [currentTrajectory, setCurrentTrajectory] = useState<{ x: number, y: number }[]>([]);
  const [currentCargoTrajectory, setCurrentCargoTrajectory] = useState<{ x: number, y: number }[]>([]);

  const [lastCheckpoint, setLastCheckpoint] = useState<Vector2>({ x: 200, y: 860 });
  const [ownedItems, setOwnedItems] = useState<EquipmentId[]>(['default']);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [equippedItem, setEquippedItem] = useState<EquipmentId>('NONE');
  const [displayStats, setDisplayStats] = useState({ hp: 100, fuel: 100, cargoHp: 100, distance: 0, distToNext: 0 });
  const [faceStatus, setFaceStatus] = useState<'idle' | 'panic' | 'dead' | 'win' | 'fast'>('idle');
  const [vedalMessage, setVedalMessage] = useState("Deliver the Rum. Don't break it.||運送蘭姆酒，別打破了。");
  const [urgentOrderProgress, setUrgentOrderProgress] = useState<{ percent: number, timeLeft: number } | null>(null);

  const [upgrades, setUpgrades] = useState<UpgradeStats>({
    engineLevel: 0, tankLevel: 0, hullLevel: 0, cableLevel: 0, cargoLevel: 0, money: INITIAL_MONEY
  });

  // Multiplayer State
  const [multiplayerMode, setMultiplayerMode] = useState<boolean>(false);
  const [multiplayerId, setMultiplayerId] = useState<string | null>(null);
  const [roomToJoin, setRoomToJoin] = useState('');
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const [isMultiplayerHost, setIsMultiplayerHost] = useState(false);
  const mpManagerRef = useRef<MultiplayerManager | null>(null);

  // New States for Room Admin & Browser
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [roomList, setRoomList] = useState<{ id: string, players: number, seed: string }[]>([]);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [joinApproved, setJoinApproved] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [autoJoin, setAutoJoin] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('neuro_drone_name') || `Drone-${Math.floor(1000 + Math.random() * 9000)}`);
  const [roomParticipants, setRoomParticipants] = useState<{ id: string, name: string }[]>([]);

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminCommand, setAdminCommand] = useState('');
  const adminInputRef = useRef<HTMLInputElement>(null);
  const [deathDetails, setDeathDetails] = useState({ reason: '', reasonDisplay: '', taunt: '' });
  const [isSpectating, setIsSpectating] = useState(false);
  const [roomLeaderboard, setRoomLeaderboard] = useState<{ id: string, distance: number, persona: string, isDead: boolean }[]>([]);
  const [allPlayersDead, setAllPlayersDead] = useState(false);
  const [isPermanentlyDead, setIsPermanentlyDead] = useState(false);
  const [spectatorTargetId, setSpectatorTargetId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<{ id: string, name: string }[]>([]);
  const [settingsTab, setSettingsTab] = useState<'general' | 'keyboard' | 'mobile' | 'room'>('general');
  const [mpUpdateRate, setMpUpdateRate] = useState<'low' | 'med' | 'high'>('med');

  // 准备状态管理
  const [playerReadyStates, setPlayerReadyStates] = useState<Map<string, boolean>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Refs for stable handleMultiplayerEvent state access
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  const remotePlayersRef = useRef(remotePlayers);
  useEffect(() => { remotePlayersRef.current = remotePlayers; }, [remotePlayers]);
  const isMultiplayerHostRef = useRef(isMultiplayerHost);
  useEffect(() => { isMultiplayerHostRef.current = isMultiplayerHost; }, [isMultiplayerHost]);
  const multiplayerIdRef = useRef(multiplayerId);
  useEffect(() => { multiplayerIdRef.current = multiplayerId; }, [multiplayerId]);

  // Custom Controls State
  const [controlsConfig, setControlsConfig] = useState<ControlsConfig>(DEFAULT_CONTROLS);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  useEffect(() => {
    const savedDist = localStorage.getItem('neuro_drone_highscore_dist');
    if (savedDist) setHighScore(parseInt(savedDist, 10));

    const savedControls = localStorage.getItem('neuro_drone_controls');
    if (savedControls) {
      try {
        const parsed = JSON.parse(savedControls);
        setControlsConfig({
          keys: { ...DEFAULT_CONTROLS.keys, ...parsed.keys },
          mobile: { ...DEFAULT_CONTROLS.mobile, ...parsed.mobile }
        });
      } catch (e) {
        console.error("Failed to load controls", e);
      }
    }

    fetch('/api/leaderboard').then(res => res.json()).then(data => {
      setLeaderboard(data);
      if (data.length > 0) setHighScore(prev => Math.max(prev, data[0].distance));
    }).catch(e => console.error("Failed to load leaderboard", e));

    const assets = [
      neuroIdle, neuroPanic, neuroWin, neuroDead,
      evilIdle, evilPanic, evilWin, evilDead
    ];

    const messages = [
      "Calibrating Gyroscopes...",
      "Refining Neural Pathways...",
      "Polishing Rum Bottles...",
      "Warming up Evil's Sass...",
      "Calculating Optimal Delivery Routes...",
      "Bribing Vedal with Coffee...",
      "Loading Turtle Swarm..."
    ];

    preloadAssets(assets, (p) => {
      setLoadingProgress(p.percent);
      setLoadingMessage(messages[Math.floor((p.percent / 101) * messages.length)]);
    }).then(() => {
      setTimeout(() => setGameState(GameState.MENU), 500);
    });
  }, []);

  // Initialize Multiplayer
  // Define Multiplayer Event Handler
  const handleMultiplayerEvent = useCallback((event: MultiplayerEvent) => {
    if (event.type === 'CONNECTED') {
      setMultiplayerId(event.peerId);
      setVedalMessage("Online functionality ready!||連線功能準備就緒！");
    } else if (event.type === 'PLAYER_JOINED') {
      setVedalMessage("A new drone has entered the airspace!||有新的無人機進入空域！");
      if (mpManagerRef.current && !mpManagerRef.current.isHost) {
        setIsMultiplayerHost(false);
      }
    } else if (event.type === 'PLAYER_LEFT') {
      setRemotePlayers(prev => {
        const next = new Map(prev);
        next.delete(event.id);
        return next;
      });
      // 清理玩家准备状态
      setPlayerReadyStates(prev => {
        const next = new Map(prev);
        if (next.has(event.id)) {
          next.delete(event.id);
        }
        return next;
      });
    } else if (event.type === 'DATA') {
      // Handle System Events
      if (event.id === 'SYSTEM') {
        if (event.data.type === 'PENDING_REQUESTS_UPDATE') {
          if (mpManagerRef.current) {
            setPendingRequests([...mpManagerRef.current.pendingRequests]);
          }
        } else if (event.data.type === 'KICKED') {
          console.log('You have been KICKED.');
          setVedalMessage("You have been kicked by the host.||你已被房主踢出房間。");
          setGameState(GameState.MENU);
          setJoinApproved(false);
        } else if (event.data.type === 'ROOM_SYNC') {
          setRoomParticipants(event.data.participants);
        }
      }

      if (event.data.type === 'PLAYER_STATE') {
        const playerId = event.data.id || event.id;

        // [ID 过滤] 如果包是发给自己（回流包），直接跳过更新 remotePlayers
        if (playerId === (multiplayerIdRef.current || 'ME')) return;

        // 房主转发逻辑: 将玩家状态转发给其他人
        if (isMultiplayerHostRef.current && mpManagerRef.current && event.id !== 'SYSTEM') {
          mpManagerRef.current.broadcast({ ...event.data, id: playerId });
        }

        setRemotePlayers(prev => {
          const next = new Map(prev);
          next.set(playerId, {
            id: playerId,
            pos: event.data.pos,
            angle: event.data.angle,
            health: event.data.health,
            persona: event.data.persona,
            cargoPos: event.data.cargoPos,
            cargoAngle: event.data.cargoAngle,
            thrustPower: event.data.thrustPower,
            // [SPECTATOR SYNC] Store UI stats
            fuel: event.data.fuel,
            hpPercent: event.data.hpPercent,
            cargoHealth: event.data.cargoHealth,
            scoreDistance: event.data.scoreDistance,
            distToNext: event.data.distToNext,
            lastUpdate: Date.now()
          });
          return next;
        });
      } else if (event.data.type === 'SYNC_RATE') {
        if (event.data.rate) {
          setMpUpdateRate(event.data.rate);
          setVedalMessage(`Host set sync rate to: ${event.data.rate.toUpperCase()}||房主調整同步頻率為: ${event.data.rate.toUpperCase()}`);
        }
      } else if (event.data.type === 'SYNC_SEED') {
        setVedalMessage("Host synced the world seed!||房主同步了世界種子！");
        setCurrentSeed(event.data.seed);
        setLastCheckpoint({ x: 200, y: 860 }); // Reset checkpoint on new seed/restart
        setGameState(prev => {
          if (prev !== GameState.WAITING_LOBBY && prev !== GameState.PLAYING) {
            return GameState.MENU;
          }
          return prev;
        });
      } else if (event.data.type === 'GAME_START') {
        // Increment gameKey to force map regeneration
        setGameKey(k => k + 1);
        setGameState(GameState.PLAYING);
        setLastCheckpoint({ x: 200, y: 860 }); // Reset checkpoint for all players
        setVedalMessage("HOST STARTED THE GAME!||房主開始了遊戲！");
      } else if (event.data.type === 'GAME_RESTART') {
        // Go to Lobby instead of Playing
        setGameState(GameState.WAITING_LOBBY);
        setAllPlayersDead(false);
        setRoomLeaderboard([]);
        setLastCheckpoint({ x: 200, y: 860 });
        setVedalMessage("HOST RESTARTED THE GAME!||房主重啟了遊戲！");
      } else if (event.data.type === 'PLAYER_DEATH') {
        const playerId = event.data.id || event.id;

        // 房主转发逻辑: 转发死亡事件
        if (isMultiplayerHostRef.current && mpManagerRef.current && event.id !== 'SYSTEM') {
          mpManagerRef.current.broadcast({ ...event.data, id: playerId });
        }

        // [排行榜去重] 房主发的死亡消息会以 SYSTEM 分身传回 handleMultiplayerEvent。
        // 或者是本地玩家收到房主转发回来的自己的死亡消息。
        // 若 playerId 就是我自己，则跳过（因为 handleCrash 已经本地更新过了）
        if (playerId === (multiplayerIdRef.current || 'ME')) return;

        // Update room leaderboard
        setRoomLeaderboard(prev => {
          const existing = prev.find(p => p.id === playerId);
          if (existing) {
            return prev.map(p => p.id === playerId ? { ...p, distance: event.data.distance, isDead: true } : p);
          } else {
            return [...prev, { id: playerId, distance: event.data.distance, persona: event.data.persona || 'NEURO', isDead: true }];
          }
        });

        // [SYNC REMOTE DEATH STATE] Explicitly update remote player's health to 0 to trigger 'X' marker in GameCanvas
        setRemotePlayers(prev => {
          const next = new Map(prev);
          const p = next.get(playerId);
          if (p) {
            next.set(playerId, { ...p as any, health: 0 });
          } else {
            // If we don't have the player yet (rare), create entry to track death location
            next.set(playerId, {
              id: playerId,
              pos: event.data.pos || { x: 0, y: 0 },
              angle: 0,
              health: 0,
              persona: event.data.persona || 'NEURO',
              lastUpdate: Date.now()
            });
          }
          return next;
        });
        // Check if all players are dead (Only host decides for everyone)
        if (isMultiplayerHostRef.current) {
          setTimeout(() => {
            const totalPlayers = remotePlayersRef.current.size + 1;
            setRoomLeaderboard(current => {
              const deadPlayers = current.filter(p => p.isDead).length;
              if (deadPlayers >= totalPlayers && totalPlayers > 1) {
                // Host broadcasts authoritative GAME OVER
                if (mpManagerRef.current) {
                  mpManagerRef.current.broadcast({ type: 'GAME_OVER_ALL' });
                }
                setAllPlayersDead(true);
                setIsSpectating(false);
              }
              return current;
            });
          }, 100);
        }
      } else if (event.data.type === 'GAME_OVER_ALL') {
        // Authoritative GAME OVER from host
        setAllPlayersDead(true);
        setIsSpectating(false);
        setVedalMessage("MISSION OVER. ALL DRONES LOST.||任務結束。所有無人機皆已墜毀。");
      } else if (event.data.type === 'GAME_RESTART') {
        // Host restarted the game - reset everything
        setAllPlayersDead(false);
        setIsPermanentlyDead(false);
        setRoomLeaderboard([]);
        setGameKey(k => k + 1);
        setGameState(GameState.WAITING_LOBBY);
        setVedalMessage("Host restarted the game!||房主重新開始了遊戲！");
      } else if (event.data.type === 'JOIN_APPROVED') {
        setWaitingApproval(false);
        setJoinApproved(true);
        setVedalMessage("HOST APPROVED YOUR ENTRY!||房主已批准加入！");
      } else if (event.data.type === 'PLAYER_READY') {
        // 玩家标记为准备
        setPlayerReadyStates(prev => {
          const next = new Map(prev);
          next.set(event.id, true);
          return next;
        });
        // 如果是房主,广播更新后的状态给所有人 (由 useEffect 处理同步更佳，但此处保持简单)
      } else if (event.data.type === 'PLAYER_UNREADY') {
        // 玩家取消准备
        setPlayerReadyStates(prev => {
          const next = new Map(prev);
          next.set(event.id, false);
          return next;
        });
      } else if (event.data.type === 'READY_STATE_SYNC') {
        // 房主同步所有玩家的准备状态
        const states = event.data.states as { [key: string]: boolean };
        setPlayerReadyStates(new Map(Object.entries(states)));
      }
      // Round 2 Fix: Forward all DATA events to GameCanvas's unique handler
      (window as any).gameRefs?.handleCanvasMpEvent?.(event);
    } else if (event.type === 'ERROR') {
      setVedalMessage(`Error: ${event.message}||錯誤：${event.message}`);
      setJoinError(event.message);
      setWaitingApproval(false);
      setJoinApproved(false);
    }
  }, [playerName]);

  // Initialize Multiplayer Effect
  useEffect(() => {
    // Expose handler for SettingsOverlay
    if (!(window as any).gameRefs) (window as any).gameRefs = {};
    (window as any).gameRefs.handleMpEvent = handleMultiplayerEvent;

    if (multiplayerMode && !mpManagerRef.current) {
      mpManagerRef.current = new MultiplayerManager(handleMultiplayerEvent);
      mpManagerRef.current.init();
    }

    return () => {
      if (!multiplayerMode && mpManagerRef.current) {
        mpManagerRef.current.disconnect();
        mpManagerRef.current = null;
        setMultiplayerId(null);
        setJoinApproved(false);
        setWaitingApproval(false);
        setRoomParticipants([]);
      }
    };
  }, [multiplayerMode, handleMultiplayerEvent]);

  useEffect(() => {
    if (mpManagerRef.current) {
      mpManagerRef.current.myName = playerName;
      localStorage.setItem('neuro_drone_name', playerName);
    }
  }, [playerName]);

  useEffect(() => {
    localStorage.setItem('neuro_drone_controls', JSON.stringify(controlsConfig));
  }, [controlsConfig]);

  useEffect(() => {
    if (displayStats.distance > highScore) {
      setHighScore(displayStats.distance);
      localStorage.setItem('neuro_drone_highscore_dist', displayStats.distance.toString());
    }
  }, [displayStats.distance, highScore]);

  // 房主自动同步准备状态给所有人
  useEffect(() => {
    if (isMultiplayerHost && mpManagerRef.current && playerReadyStates.size > 0) {
      const states: { [key: string]: boolean } = {};
      playerReadyStates.forEach((ready, id) => {
        states[id] = ready;
      });
      mpManagerRef.current.broadcast({
        type: 'READY_STATE_SYNC',
        states: states
      });
    }
  }, [playerReadyStates, isMultiplayerHost]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if ((gameState === GameState.PLAYING || gameState === GameState.CHECKPOINT_SHOP) && !isLayoutEditing) {
      interval = setInterval(() => {
        setGameTime(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState, isLayoutEditing]);

  const togglePause = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      if (multiplayerMode) {
        // In MP, don't pause game, just show settings
        setShowSettings(true);
      } else {
        setGameState(GameState.PAUSED);
        setShowSettings(true);
      }
      SoundManager.play('shop');
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
      setShowSettings(false);
      SoundManager.play('shop');
    } else if (gameState === GameState.PLAYING && multiplayerMode && showSettings) {
      // Close settings in MP
      setShowSettings(false);
    }
  }, [gameState, multiplayerMode, showSettings]);

  // Handle Pause Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === controlsConfig.keys.pause) {
        togglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause, controlsConfig.keys.pause]);

  const handleStart = (seedOrEntry?: string | LeaderboardEntry) => {
    if (multiplayerMode && mpManagerRef.current) {
      mpManagerRef.current.myName = playerName;
    }
    SoundManager.init();
    SoundManager.play('shop');

    // iOS Safari 的全屏 API 可能不可用或被阻止,不应阻塞游戏启动
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => { });
    }

    setLastCheckpoint({ x: 200, y: 860 });

    let seedToUse: string | undefined;
    let entryToChallenge: LeaderboardEntry | undefined;

    if (typeof seedOrEntry === 'string') {
      seedToUse = seedOrEntry;
    } else if (seedOrEntry) {
      entryToChallenge = seedOrEntry;
      seedToUse = entryToChallenge.seed;
    }

    if (seedToUse) {
      setCurrentSeed(seedToUse);
      setIsChallengingSeed(true);
      if (entryToChallenge && entryToChallenge.trajectory && entryToChallenge.trajectory.length > 0) {
        setGhostData({
          trajectory: entryToChallenge.trajectory,
          cargoTrajectory: entryToChallenge.cargoTrajectory,
          name: entryToChallenge.name
        });
      } else {
        setGhostData(null);
      }
    } else if (gameState !== GameState.MENU) {
      setCurrentSeed(Math.random().toString(36).substring(2, 9).toUpperCase());
      setIsChallengingSeed(false);
      setGhostData(null);
    } else {
      setIsChallengingSeed(false);
      setGhostData(null);
    }

    setGameKey(k => k + 1);

    // Multiplayer Flow: Enter Lobby first
    if (multiplayerMode) {
      if (!isMultiplayerHost && !joinApproved) {
        setVedalMessage("Join a room and wait for approval!||請先加入房間並等待批准。");
        return;
      }
      // Generate seed if not already set (for host)
      if (!seedToUse && isMultiplayerHost) {
        const newSeed = Math.random().toString(36).substring(2, 9).toUpperCase();
        setCurrentSeed(newSeed);
        // Broadcast seed to all connected players
        if (mpManagerRef.current) {
          mpManagerRef.current.broadcast({ type: 'SYNC_SEED', seed: newSeed });
        }
      } else if (!seedToUse && !isMultiplayerHost) {
        // Client should already have seed from SYNC_SEED, but if not, wait for it
        // Don't generate a random seed here
      }
      setGameState(GameState.WAITING_LOBBY);
      setIsReady(true); // 选择角色即视为准备
      if (mpManagerRef.current && !isMultiplayerHost) {
        mpManagerRef.current.broadcast({ type: 'PLAYER_READY' });
      }
      return;
    } else {
      setGameState(GameState.PLAYING);
    }

    setUrgentOrderProgress(null);
    setGameTime(0);
    setCurrentTrajectory([]);
    setCurrentCargoTrajectory([]);
    setIsSpectating(false);
    setShowSettings(false); // Force close settings
  };

  const setStats = useCallback((hp: number, fuel: number, cargoHp: number, distance: number, distToNext: number, trainX?: number) => {
    setDisplayStats({ hp, fuel, cargoHp, distance, distToNext });

    // Elimination Mode Check: If train passed current checkpoint while in Game Over
    if (gameState === GameState.GAME_OVER && multiplayerMode && trainX !== undefined && !isPermanentlyDead) {
      if (trainX >= lastCheckpoint.x) {
        setIsPermanentlyDead(true);
        setVedalMessage("CHECKPOINT CONSUMED BY HYPE TRAIN! NO RESPAWN POSSIBLE.||存檔點已被發燒列車吞噬！無法重生。");
      }
    }
  }, [gameState, multiplayerMode, lastCheckpoint.x, isPermanentlyDead]);

  const saveToLeaderboard = async (name: string, distance: number, time: number, trajectory?: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[]) => {
    const entry: LeaderboardEntry = {
      name, distance, time, date: new Date().toLocaleString('zh-TW', { hour12: false }).replace(/\//g, '-'),
      persona, difficulty, isMobile: isMobileMode, seed: currentSeed, trajectory, cargoTrajectory
    };

    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaderboard(data);
      setHighScore(prev => Math.max(prev, distance));
      setPendingScore(null);

      if (postScoreAction === 'RESTART') handleRestartFull();
      else if (postScoreAction === 'MENU') {
        setShowSettings(false);
        setGameState(GameState.MENU);
      }
      setPostScoreAction(null);
    } catch (e) {
      console.error("Failed to save score", e);
    }
  };

  const handleBackToMenu = () => {
    if (finalDistance > 0 || displayStats.distance > 0) {
      const dist = finalDistance || displayStats.distance;
      const time = gameState === GameState.GAME_OVER ? gameTime : gameTime; // gameTime is already tracked
      setPostScoreAction('MENU');
      setPendingScore({
        distance: dist,
        time: time,
        trajectory: currentTrajectory,
        cargoTrajectory: currentCargoTrajectory
      });
    } else {
      setShowSettings(false);
      setGameState(GameState.MENU);
    }
  };

  const handleRespawn = useCallback(() => {
    if (isPermanentlyDead) {
      setVedalMessage("Checkpoint consumed. Mission failed permanently.||存檔點已毀。任務永久失敗。");
      return;
    }
    SoundManager.play('shop');

    // [MULTIPLAYER FIX] In multiplayer, do NOT remount GameCanvas (change key) on respawn.
    // This preserves the train instance and state.
    // [FIX] In Single Player, we also don't want to remount if we want to preserve the ghost trajectory correctly.
    // setGameKey(k => k + 1); // Removed to prevent remounting and state loss

    setRespawnToken(t => t + 1);
    setGameState(GameState.PLAYING);
    setUrgentOrderProgress(null);
    setIsSpectating(false);
  }, [isPermanentlyDead, multiplayerMode]);

  const handleCrash = useCallback((reason: string, finalDist: number, trajectory?: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[], trainX?: number) => {
    // Multiplayer Logic: Elimination Mode
    if (multiplayerMode && trainX !== undefined) {
      // [FIX] 3-State Respawn Logic
      // 1. Train Passed Checkpoint -> Permanent Death
      // 2. Train Close (Danger Zone) -> Manual Respawn (Prevents infinite loop)
      // 3. Train Far (Safe) -> Auto Respawn

      if (trainX >= lastCheckpoint.x) {
        // [CASE 1] Checkpoint Consumed
        setIsPermanentlyDead(true);
        setVedalMessage("CHECKPOINT CONSUMED BY HYPE TRAIN! NO RESPAWN POSSIBLE.||存檔點已被發燒列車吞噬！無法重生。");
      } else if (trainX < lastCheckpoint.x - 400) {
        // [CASE 3] Safe -> Auto Respawn
        handleRespawn();
        setVedalMessage("Neuro Re-fabricated! Checkpoint is safe.||Neuro 重組完成！存檔點安全。");
        return;
      } else {
        // [CASE 2] Danger Zone (Train is approaching checkpoint)
        // Show Game Over screen to break the infinite death loop
        setVedalMessage("WARNING: TRAIN INCOMING! RESPAWN CAREFULLY!||警告：火車逼近！請小心重生！");
        // Fall through to normal GAME_OVER to allow manual respawn
      }
    }

    SoundManager.play('crash');
    setGameState(GameState.GAME_OVER);
    if (multiplayerMode) setIsSpectating(true); // 死亡后自动开启观战
    setUrgentOrderProgress(null);
    setFinalDistance(finalDist);
    const penalty = 50;
    setMoney(prev => Math.max(0, prev - penalty));
    setVedalMessage(`Mission Failed. -$${penalty} fee.||任務失敗。扣除 $${penalty} 手續費。`);

    const TAUNTS: any = {
      WALL: ["Bonk.||倒楣。", "Oof.||喔噗。", "Flat.||變扁了。"],
      LASER: ["Grilled.||烤焦了。", "Zapped!!||中電！", "Medium Rare.||五分熟。"],
      FUEL: ["Empty.||乾了。", "No Gas.||沒氣了。", "Walking Time?||該走路了？"],
      CARGO: ["Broken.||打破了。", "Refunded.||退貨中。", "Vedal is mad.||主人要生氣了。"],
      VOID: ["Lost.||迷失了。", "Deep.||深不可測。", "Bye bye.||掰掰。"],
      TRAIN: ["Choo Choo!||火車快跑！", "Railed.||被輾過了。", "Ticket please?||請出示車票？"]
    };
    const DEATH_DISPLAY_NAMES: any = { WALL: "撞擊", LASER: "雷射", FUEL: "沒油", CARGO: "貨損", VOID: "深淵", TRAIN: "遭列車輾斃" };

    const list = TAUNTS[reason] || TAUNTS['WALL'];
    const taunt = list[Math.floor(Math.random() * list.length)];
    setDeathDetails({ reason, reasonDisplay: DEATH_DISPLAY_NAMES[reason] || reason, taunt });

    if (finalDist > highScore) setHighScore(finalDist);
    setCurrentTrajectory(trajectory || []);
    setCurrentCargoTrajectory(cargoTrajectory || []);

    // Multiplayer: Broadcast death and update room leaderboard
    if (multiplayerMode && mpManagerRef.current) {
      mpManagerRef.current.broadcast({
        type: 'PLAYER_DEATH',
        distance: finalDist,
        persona: persona === Persona.NEURO ? 'NEURO' : 'EVIL'
      });

      // Add self to room leaderboard
      setRoomLeaderboard(prev => {
        const myId = multiplayerIdRef.current || 'ME';
        const existing = prev.find(p => p.id === myId);
        if (existing) {
          return prev.map(p => p.id === myId ? { ...p, distance: finalDist, isDead: true } : p);
        } else {
          return [...prev, { id: myId, distance: finalDist, persona: persona === Persona.NEURO ? 'NEURO' : 'EVIL', isDead: true }];
        }
      });

      // Check if all players are dead
      setTimeout(() => {
        const totalPlayers = remotePlayersRef.current.size + 1;
        setRoomLeaderboard(current => {
          const deadPlayers = current.filter(p => p.isDead).length;
          if (deadPlayers >= totalPlayers && totalPlayers > 1) {
            setAllPlayersDead(true);
            setIsSpectating(false);
            // [HOST BROADCAST] Synchronize final game over to all clients
            if (mpManagerRef.current) {
              mpManagerRef.current.broadcast({ type: 'GAME_OVER_ALL' });
            }
          }
          return current;
        });
      }, 100);
    }
  }, [highScore, multiplayerMode, lastCheckpoint, handleRespawn, mpManagerRef, multiplayerId, persona]);

  const handleBuyUpgrade = (type: keyof UpgradeStats, cost: number) => {
    if (money >= cost) {
      SoundManager.play('coin');
      setMoney(prev => prev - cost);
      setUpgrades(prev => ({ ...prev, [type]: (prev[type] as number) + 1 }));
    }
  };

  const handleRandomUpgrade = useCallback((upgradeName: string) => {
    const keys: (keyof UpgradeStats)[] = ['engineLevel', 'tankLevel', 'hullLevel', 'cableLevel', 'cargoLevel'];
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    setUpgrades(prev => ({ ...prev, [randomKey]: (prev[randomKey] as number) + 1 }));
    const names: { [key: string]: string } = { engineLevel: "Thrusters", tankLevel: "Fuel Tank", hullLevel: "Hull Armor", cableLevel: "Elastic Rope", cargoLevel: "Cargo Cage" };
    return names[randomKey];
  }, []);

  const handleBuyItem = (item: EquipmentId, cost: number) => {
    if (money >= cost && !ownedItems.includes(item)) {
      SoundManager.play('coin');
      setMoney(prev => prev - cost);
      setOwnedItems(prev => [...prev, item]);
      setEquippedItem(item);
    }
  };

  const handleEquipItem = (item: EquipmentId) => {
    SoundManager.play('shop');
    setEquippedItem(item);
  };

  const handleNextSpectate = () => {
    if (!multiplayerMode) return;
    const players = Array.from(remotePlayers.values()).filter((p: any) => p.health > 0);
    if (players.length === 0) return;

    setSpectatorTargetId(currentId => {
      if (!currentId) return (players[0] as any).id;
      const currentIndex = players.findIndex((p: any) => p.id === currentId);
      const nextIndex = (currentIndex + 1) % players.length;
      return (players[nextIndex] as any).id;
    });
  };

  const handleForceRestart = () => {
    if (multiplayerMode && isMultiplayerHost && mpManagerRef.current) {
      mpManagerRef.current.broadcast({ type: 'GLOBAL_RESTART' });
      // Also trigger locally
      handleMultiplayerEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'GLOBAL_RESTART' } });
    }
  };

  const handleRestartFull = () => handleStart();

  const handleBuyRefuel = () => {
    if (money >= 10) {
      SoundManager.play('coin');
      setMoney(m => m - 10);
      const refs = (window as any).gameRefs;
      if (refs?.drone) refs.drone.fuel = refs.drone.maxFuel;
    }
  };

  const handleBuyRepair = () => {
    if (money >= 20) {
      SoundManager.play('coin');
      setMoney(m => m - 20);
      const refs = (window as any).gameRefs;
      if (refs?.drone) refs.drone.health = refs.drone.maxHealth;
    }
  };

  const handleLaunchFromShop = () => {
    SoundManager.play('shop');
    setGameState(GameState.PLAYING);
    const refs = (window as any).gameRefs;
    if (refs?.drone) { refs.drone.vel.y = -3.0; refs.drone.pos.y -= 5.0; }
  };

  const executeAdminCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCmd = adminCommand.toLowerCase().trim();
    const refs = (window as any).gameRefs;
    if (rawCmd === 'money') setMoney(m => m + 10000);
    else if (rawCmd === 'god' && refs?.drone) refs.drone.isGodMode = !refs.drone.isGodMode;
    else if (rawCmd === 'die') handleCrash('WALL', 0);
    setAdminCommand('');
    setShowAdmin(false);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none touch-none">

      {gameState === GameState.LOADING && (
        <LoadingScreen progress={loadingProgress} message={loadingMessage} />
      )}

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-50 p-4 overflow-y-auto pointer-events-auto">
          <h1
            onClick={() => setShowSettings(true)}
            className="text-6xl font-bold text-pink-400 mb-2 font-vt323 tracking-widest text-center cursor-pointer hover:scale-105 hover:brightness-125 transition-all active:scale-95 group relative"
          >
            Neuro's Drone Delivery<br />
            <span className="text-3xl text-yellow-400">ENDLESS NIGHTMARE</span>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-pink-500/50 opacity-0 group-hover:opacity-100 transition-opacity tracking-normal font-sans">CLICK FOR SETTINGS (點擊進入設置)</div>
          </h1>

          <div className="bg-slate-800 p-6 rounded-lg border border-slate-600 mb-6 max-w-md w-full">
            <div className="text-center mb-6 border-b border-slate-600 pb-4 cursor-pointer hover:bg-slate-700/30 rounded-lg p-2 transition-all active:scale-95 group relative" onClick={() => setShowLeaderboard(true)}>
              <span className="text-cyan-500 font-bold text-lg tracking-widest group-hover:text-cyan-400">🏆 LONGEST FLIGHT (榜一) 🏆</span>
              <div className="text-5xl text-white font-mono mt-2">{highScore}m</div>
              {isMultiplayerHost && mpManagerRef.current && mpManagerRef.current.pendingRequests.length > 0 && (
                <div
                  onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-bounce shadow-lg border border-white cursor-pointer z-[60]"
                >
                  {mpManagerRef.current.pendingRequests.length} REQUESTS
                </div>
              )}
            </div>

            {/* Nickname Input moved here */}
            <div className="flex gap-2 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-4">
              <span className="text-cyan-400 font-bold font-vt323 text-xl tracking-widest uppercase flex items-center">
                Courier Name:
                <InfoTooltip text="輸入您的外送員代號，這將顯示在排行榜與房間名單中。" />
              </span>
              <input
                type="text"
                placeholder="Enter Nickname"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
                className="flex-1 bg-slate-800 text-sm p-2 rounded border border-slate-600 outline-none focus:border-cyan-500 text-cyan-300 font-mono"
              />
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-white font-bold flex items-center">
                  Multiplayer
                  <InfoTooltip text="開啟後可與線上其他外送員競爭或觀戰；關閉則進入純單機作業。" />
                </span>
                <button
                  onClick={() => setMultiplayerMode(!multiplayerMode)}
                  className={`px-4 py-1 rounded font-bold transition-colors ${multiplayerMode ? 'bg-cyan-500 text-white' : 'bg-slate-500 text-gray-300'}`}
                >
                  {multiplayerMode ? 'ENABLED (連機中)' : 'DISABLED (離線)'}
                </button>
              </div>

              {multiplayerMode && (
                <div className="flex flex-col gap-2 p-2 bg-slate-900/50 rounded border border-cyan-900">
                  <div className="flex justify-between items-center h-8">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-500 font-mono">MY ID: {multiplayerId || 'CONNECTING...'}</span>
                      {multiplayerId && (
                        <button
                          onClick={(e) => {
                            const id = multiplayerId.replace('NEURO-', '');
                            // Fallback copy logic
                            try {
                              navigator.clipboard.writeText(id).catch(() => {
                                // Manual fallback
                                const el = document.createElement('input');
                                el.value = id;
                                document.body.appendChild(el);
                                el.select();
                                document.execCommand('copy');
                                document.body.removeChild(el);
                              });
                            } catch (err) {
                              const el = document.createElement('input');
                              el.value = id;
                              document.body.appendChild(el);
                              el.select();
                              document.execCommand('copy');
                              document.body.removeChild(el);
                            }
                            setVedalMessage("ID Copied!||ID 已複製！");
                          }}
                          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          COPY
                        </button>
                      )}
                    </div>
                    <button
                      disabled={!multiplayerId}
                      onClick={() => {
                        if (mpManagerRef.current) {
                          mpManagerRef.current.host();
                          setIsMultiplayerHost(true);
                          setJoinApproved(true);
                          setVedalMessage("Hosting room. Share your ID!||創建房間成功。分享你的 ID！");
                          // Initialize local participant list
                          setRoomParticipants([{ id: mpManagerRef.current.myId || 'HOST', name: playerName }]);
                          setPlayerReadyStates(new Map([[mpManagerRef.current.myId || 'HOST', true]])); // 房主默认准备
                          setIsReady(true);
                        }
                      }}
                      className={`text-xs px-3 py-1.5 rounded font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 ${isMultiplayerHost ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-cyan-700 hover:bg-cyan-600 text-white'}`}
                    >
                      {isMultiplayerHost ? '● HOSTING' : 'BE HOST'}
                    </button>
                    <InfoTooltip text="創建一個新的配送房間，並獲得一個專屬 ID 分享給好友。" />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Room ID (e.g. 5X7B)..."
                      value={roomToJoin}
                      onChange={(e) => setRoomToJoin(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-800 text-xs p-2 rounded border border-slate-600 outline-none focus:border-cyan-500 text-cyan-300 font-mono"
                    />
                    <button
                      onClick={(e) => {
                        if (roomToJoin) {
                          mpManagerRef.current?.join(roomToJoin.startsWith('NEURO-') ? roomToJoin : `NEURO-${roomToJoin}`, playerName);
                          setIsMultiplayerHost(false);
                          setWaitingApproval(true);
                          setJoinApproved(false);
                        }
                      }}
                      className="bg-pink-600 px-4 py-1 text-xs rounded font-bold hover:bg-pink-500 active:scale-95 cursor-pointer text-white flex items-center gap-1"
                    >
                      JOIN
                      <InfoTooltip text="輸入好友的房間 ID 並請求加入其配送任務。" position="right" />
                    </button>
                  </div>
                  {/* BROWSE ROOMS BUTTON */}
                  <button
                    onClick={() => {
                      setShowRoomBrowser(true);
                      MultiplayerManager.getRooms().then(setRoomList);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-xs py-1 rounded font-bold mt-1 flex items-center justify-center gap-1"
                  >
                    BROWSE ROOMS (瀏覽房間)
                    <InfoTooltip text="啟動區域掃描，尋找當前所有可加入的公開配送房間。" />
                  </button>
                </div>
              )}


              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-white font-bold flex items-center">
                  Mode
                  <InfoTooltip text="切換操作模式。簡單模式有無人機自動找正；普通模式為全物理手動控制。" />
                </span>
                <button onClick={() => setDifficulty(d => d === 'NORMAL' ? 'EASY' : 'NORMAL')} className={`px-4 py-1 rounded font-bold transition-colors ${difficulty === 'EASY' ? 'bg-green-500 text-white' : 'bg-slate-500 text-gray-300'}`}>
                  {difficulty === 'EASY' ? 'EASY (MOUSE/JOY)' : 'NORMAL (WASD)'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-white font-bold flex items-center">
                  Mobile Controls
                  <InfoTooltip text="為觸控螢幕優化介面，開啟後會顯示虛擬搖桿與按鍵。" />
                </span>
                <button onClick={() => setIsMobileMode(!isMobileMode)} className={`w-16 h-8 rounded-full transition-colors relative border-2 border-slate-700 ${isMobileMode ? 'bg-pink-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${isMobileMode ? 'translate-x-8' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            {multiplayerMode && !isMultiplayerHost && waitingApproval ? (
              <div className="w-full text-center p-4 bg-slate-800/80 rounded border border-yellow-500 animate-pulse text-yellow-400 font-bold tracking-widest">
                WAITING FOR HOST APPROVAL... (等待房主批准...)
              </div>
            ) : multiplayerMode && !isMultiplayerHost && !joinApproved ? (
              <div className="w-full text-center p-4 bg-slate-800/80 rounded border border-cyan-500 text-cyan-400 font-bold tracking-widest">
                JOIN A ROOM TO PLAY (請加入房間後開始)
              </div>
            ) : (
              <>
                {joinApproved && !isMultiplayerHost && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-green-400 font-bold animate-bounce whitespace-nowrap">
                    ✓ APPROVED! SELECT YOUR DRONE
                  </div>
                )}
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => { setPersona(Persona.NEURO); handleStart(); }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      // iOS Safari 有时不会触发 onClick,所以在 touch 事件中也执行
                      if (!(multiplayerMode && !isMultiplayerHost && !joinApproved)) {
                        e.preventDefault(); // 防止后续的 click 事件
                        setPersona(Persona.NEURO);
                        handleStart();
                      }
                    }}
                    className={`flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-4 px-8 rounded shadow-lg transition-all active:scale-95 touch-manipulation ${multiplayerMode && !isMultiplayerHost && !joinApproved ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
                    disabled={multiplayerMode && !isMultiplayerHost && !joinApproved}
                    style={{ WebkitTapHighlightColor: 'rgba(236, 72, 153, 0.3)', touchAction: 'manipulation' }}
                  >
                    PLAY AS NEURO
                  </button>
                  <InfoTooltip text="以標準模式開始任務。此角色具有隨機的系統延遲模擬。" position="right" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => { setPersona(Persona.EVIL); handleStart(); }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.transform = 'scale(0.95)';
                    }}
                    onTouchEnd={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      // iOS Safari 有时不会触发 onClick,所以在 touch 事件中也执行
                      if (!(multiplayerMode && !isMultiplayerHost && !joinApproved)) {
                        e.preventDefault(); // 防止后续的 click 事件
                        setPersona(Persona.EVIL);
                        handleStart();
                      }
                    }}
                    className={`flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded shadow-lg transition-all active:scale-95 touch-manipulation ${multiplayerMode && !isMultiplayerHost && !joinApproved ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
                    disabled={multiplayerMode && !isMultiplayerHost && !joinApproved}
                    style={{ WebkitTapHighlightColor: 'rgba(220, 38, 38, 0.3)', touchAction: 'manipulation' }}
                  >
                    PLAY AS EVIL
                  </button>
                  <InfoTooltip text="以高速模式開始任務。具有更強的推力但燃料消耗也更快。" position="right" />
                </div>
              </>
            )}
          </div>
        </div>
      )
      }

      {
        showLeaderboard && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 sm:p-20 pointer-events-auto">
            <Leaderboard entries={leaderboard} onClose={() => setShowLeaderboard(false)} onChallengeSeed={(seed) => { setShowLeaderboard(false); handleStart(seed); }} />
          </div>
        )
      }

      {/* Room Browser Overlay */}
      {
        showRoomBrowser && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border-4 border-purple-500 p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-400">PUBLIC ROOMS</h2>
                <button onClick={() => setShowRoomBrowser(false)} className="bg-red-600 px-3 py-1 rounded text-white font-bold">X</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {roomList.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">NO ROOMS FOUND...</div>
                ) : (
                  roomList.map(room => (
                    <div key={room.id} className="bg-slate-700 p-3 rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold text-cyan-300">ROOM {room.id.slice(-4)}</div>
                        <div className="text-xs text-gray-400">Players: {room.players} | Seed: {room.seed}</div>
                      </div>
                      <button
                        onClick={() => {
                          setRoomToJoin(room.id);
                          setShowRoomBrowser(false);
                          mpManagerRef.current?.join(room.id);
                          setIsMultiplayerHost(false);
                          setWaitingApproval(true);
                          setJoinApproved(false);
                        }}
                        className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-white font-bold text-sm"
                      >
                        JOIN
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={() => MultiplayerManager.getRooms().then(setRoomList)}
                  className="text-purple-400 underline text-sm"
                >
                  Refresh List
                </button>
              </div>
            </div>
          </div >
        )
      }

      {/* Lobby Waiting Screen */}
      {
        gameState === GameState.WAITING_LOBBY && (
          <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-md text-white pointer-events-auto">
            <div
              onClick={() => setShowSettings(true)}
              className="group relative flex flex-col items-center cursor-pointer mb-8 transition-all hover:scale-105 active:scale-95"
              title="Click to change Avatar / Settings (點擊更換頭像/設定)"
            >
              <div className="transform scale-150 border-4 border-transparent group-hover:border-cyan-500/30 rounded-full transition-all duration-300">
                <NeuroFace status="idle" persona={persona} />
              </div>
              <div className="absolute -bottom-10 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-900/90 text-cyan-400 text-[10px] px-2 py-1 rounded border border-cyan-500 font-bold tracking-widest whitespace-nowrap z-10 pointer-events-none">
                CLICK TO CHANGE AVATAR / SETTINGS
              </div>
            </div>

            {isMultiplayerHost ? (
              <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <h2 className="text-5xl font-bold text-green-400 animate-pulse font-vt323 tracking-widest mb-2">LOBBY (已就緒)</h2>

                <div className="w-full bg-slate-800/80 p-5 rounded-xl border-2 border-slate-700 shadow-xl">
                  <h3 className="text-cyan-400 font-bold border-b-2 border-slate-700 pb-3 mb-4 tracking-widest text-center uppercase">
                    READY PARTICIPANTS ({roomParticipants.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {roomParticipants.length > 0 ? (
                      roomParticipants.map((p) => (
                        <div key={p.id} className="flex flex-col bg-slate-900/80 border border-slate-700 p-3 rounded-lg relative overflow-hidden group">
                          <div className={`absolute top-0 left-0 w-1 h-full ${p.id === multiplayerId ? 'bg-cyan-500' : 'bg-green-500'} opacity-50`}></div>
                          <span className="text-white font-bold text-sm truncate">{p.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono mt-1">ID: {p.id.slice(-6)}</span>
                          {/* 准备状态显示 */}
                          <div className="mt-2 text-[10px] font-bold">
                            {playerReadyStates.get(p.id) ? (
                              <span className="text-green-400">✓ 已準備</span>
                            ) : (
                              <span className="text-yellow-500">⏳ 未準備</span>
                            )}
                          </div>
                          {p.id === multiplayerId && <span className="absolute top-1 right-1 text-[8px] bg-cyan-900/80 text-cyan-400 px-1 rounded border border-cyan-800 font-bold">YOU</span>}
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center text-slate-500 py-4 italic">Waiting for room sync...</div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    console.log("[LOBBY] Start button clicked");
                    if (mpManagerRef.current) {
                      console.log("[LOBBY] Broadcasting start");
                      // Send to clients
                      mpManagerRef.current.broadcast({ type: 'GAME_START' });
                      // Trigger locally
                      handleMultiplayerEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'GAME_START' } });
                    } else {
                      console.error("[LOBBY] mpManagerRef is null");
                    }
                  }}
                  disabled={(() => {
                    // 检查是否所有玩家都准备
                    const allReady = roomParticipants.every(p => playerReadyStates.get(p.id) === true);
                    return !allReady;
                  })()}
                  className={`w-full font-bold py-4 rounded-xl text-2xl tracking-widest cursor-pointer relative z-[310] transition-all ${roomParticipants.every(p => playerReadyStates.get(p.id) === true)
                    ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse text-white'
                    : 'bg-gray-600 cursor-not-allowed text-gray-400'
                    }`}
                >
                  {roomParticipants.every(p => playerReadyStates.get(p.id) === true)
                    ? 'START GAME (開始)'
                    : `等待玩家準備 (${roomParticipants.filter(p => playerReadyStates.get(p.id)).length}/${roomParticipants.length})`
                  }
                </button>

                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg border-2 border-slate-600 shadow-lg tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  ⚙️ SETTINGS (系統設定)
                </button>

                {mpManagerRef.current && mpManagerRef.current.pendingRequests.length > 0 && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-full bg-yellow-600/80 hover:bg-yellow-500 text-black font-bold py-2 rounded border-2 border-yellow-400 animate-pulse flex items-center justify-center gap-2"
                  >
                    ⚠️ {mpManagerRef.current.pendingRequests.length} PENDING REQUESTS
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-5xl font-bold text-cyan-400 animate-pulse font-vt323 tracking-widest mb-4">WAITING FOR HOST...</h2>
                  <div className="bg-slate-800 p-6 rounded-lg border-2 border-slate-600 text-center w-full">
                    <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">CURRENT SECTOR</p>
                    <p className="text-2xl font-mono font-bold text-white mb-4">{currentSeed}</p>
                    <div className="flex gap-2 justify-center">
                      <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg border-2 border-slate-600 shadow-lg tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  ⚙️ SETTINGS (系統設定)
                </button>
              </div>
            )}
          </div>
        )
      }

      {
        pendingScore && (
          <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-md pointer-events-auto p-4">
            <div className={`bg-slate-800 border-4 border-cyan-500 p-8 rounded-xl shadow-2xl max-w-sm w-full animate-bounce-short`}>
              <h2 className={`text-3xl font-bold mb-1 text-center font-vt323 tracking-widest text-cyan-400`}>⭐ NEW RECORD ⭐</h2>
              <input autoFocus type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value.slice(0, 12))} placeholder="Name..." className="w-full bg-slate-900 border-2 border-slate-600 rounded p-3 text-white font-bold mb-4 outline-none focus:border-cyan-500" />
              <div className="flex gap-2">
                <button onClick={() => saveToLeaderboard(playerName || 'Anonymous', pendingScore.distance, pendingScore.time, pendingScore.trajectory, pendingScore.cargoTrajectory)} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded">SAVE</button>
                <button onClick={() => {
                  setPendingScore(null);
                  if (postScoreAction === 'RESTART') handleRestartFull();
                  else if (postScoreAction === 'MENU') {
                    setShowSettings(false);
                    setGameState(GameState.MENU);
                  }
                }} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded">SKIP</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Joining Requests Notification Overlay */}
      {
        pendingRequests.length > 0 && isMultiplayerHost && (
          <div className="absolute top-6 right-6 z-[500] space-y-3 pointer-events-auto">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-slate-900/90 border-2 border-yellow-500 p-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] backdrop-blur-md animate-slide-in-right max-w-xs border-l-8">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-yellow-500 text-sm tracking-widest uppercase">New Join Request</div>
                  <div className="text-[10px] text-slate-500 font-mono">ID: {req.id.slice(-4)}</div>
                </div>
                <div className="text-white text-lg font-bold mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  {req.name}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (mpManagerRef.current) mpManagerRef.current.approveJoin(req.id, currentSeed);
                      setPendingRequests(prev => prev.filter(p => p.id !== req.id));
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95"
                  >
                    ACCEPT
                  </button>
                  <button
                    onClick={() => {
                      if (mpManagerRef.current) mpManagerRef.current.rejectJoin(req.id);
                      setPendingRequests(prev => prev.filter(p => p.id !== req.id));
                    }}
                    className="bg-red-600/30 hover:bg-red-600 text-red-200 py-2 px-4 rounded-lg text-sm border border-red-500/50 transition-all active:scale-95"
                  >
                    REJECT
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSettingsTab('room');
                    setShowSettings(true);
                  }}
                  className="w-full text-center text-slate-500 text-[10px] mt-2 underline hover:text-slate-300"
                >
                  Manage in Admin Menu
                </button>
              </div>
            ))}
          </div>
        )
      }

      {
        gameState === GameState.CHECKPOINT_SHOP && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/60 backdrop-blur-sm pointer-events-auto">
            <div className="bg-slate-800 border-4 border-green-500 p-8 rounded-lg text-center shadow-2xl">
              <h2 className="text-4xl font-bold text-green-400 mb-2">CHECKPOINT</h2>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <div className="relative group flex items-center">
                  <button onClick={handleBuyRefuel} className="bg-blue-600 text-white p-4 rounded-lg w-32 border-2 border-blue-400">FUEL $10</button>
                  <InfoTooltip text="緊急補充全部燃料。燃料耗盡將導致配送失敗。" position="bottom" />
                </div>
                <div className="relative group flex items-center">
                  <button onClick={handleBuyRepair} className="bg-red-600 text-white p-4 rounded-lg w-32 border-2 border-red-400">FIX $20</button>
                  <InfoTooltip text="修復無人機機身損害。血量歸零將導致配送失敗。" position="bottom" />
                </div>
                <div className="relative group flex items-center">
                  <button onClick={() => setGameState(GameState.SHOP)} className="bg-purple-600 text-white p-4 rounded-lg w-32 border-2 border-purple-400">UPGRADE</button>
                  <InfoTooltip text="前往科學家 Vedal 的工作坊，升級硬體或購買特殊裝備。" position="bottom" />
                </div>
              </div>
              <button onClick={handleLaunchFromShop} className="bg-gray-200 text-black font-bold py-3 px-8 rounded-full text-xl flex items-center gap-2">
                LAUNCH
                <InfoTooltip text="完成補給，即刻出發！" />
              </button>
            </div>
          </div>
        )
      }

      {
        gameState === GameState.GAME_OVER && !isSpectating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-50 backdrop-blur-sm pointer-events-auto">
            <div className="mb-6 transform scale-150 cursor-pointer hover:brightness-125 active:scale-140 transition-all" onClick={() => setShowSettings(true)}>
              <NeuroFace status="dead" persona={persona} />
              <div className="absolute -bottom-4 right-0 bg-cyan-600 text-[10px] px-1 rounded border border-cyan-400 font-bold opacity-0 hover:opacity-100 transition-opacity">SETTINGS</div>
            </div>
            <h1 className="text-6xl text-red-500 font-bold mb-2 tracking-widest">WASTED</h1>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-red-400 mb-1">
                {deathDetails.reasonDisplay}
              </h2>
              <div className="text-xl font-bold text-slate-300 flex items-center justify-center gap-4">
                <span>DISTANCE: <span className="text-white">{finalDistance}m</span></span>
                <span className="text-cyan-400 border-l border-slate-600 pl-4">
                  RANK: #{leaderboard.filter(e => e.distance > finalDistance).length + 1}
                </span>
              </div>
              <p className="text-slate-400 mt-1">TIME: {Math.floor(gameTime)}s</p>
              <p className="text-xl text-yellow-500 font-vt323 tracking-wider italic mt-2">
                {deathDetails.taunt.split('||')[1] || deathDetails.taunt.split('||')[0]}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6">
              {!multiplayerMode ? (
                <>
                  <button onClick={handleRespawn} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-10 rounded shadow-lg transition-all active:scale-95">RESPAWN (繼續)</button>
                  <button onClick={() => { if (finalDistance > 0) { setPostScoreAction('RESTART'); setPendingScore({ distance: finalDistance, time: gameTime, trajectory: currentTrajectory, cargoTrajectory: currentCargoTrajectory }); } else handleRestartFull(); }} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-10 rounded transition-all active:scale-95">RESTART (重開)</button>
                </>
              ) : (
                <button onClick={() => setIsSpectating(true)} className="bg-yellow-600 text-white font-bold py-3 px-8 rounded shadow-lg animate-pulse transition-all active:scale-95">SPECTATE (觀戰)</button>
              )}
              <button onClick={handleBackToMenu} className="py-3 px-8 text-gray-400 underline">Menu</button>
            </div>
          </div>
        )
      }

      {/* Multiplayer Room Leaderboard - All Players Dead */}
      {
        multiplayerMode && allPlayersDead && (
          <div className="absolute inset-0 z-[250] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white pointer-events-auto">
            <div className="bg-slate-800 border-4 border-red-500 p-8 rounded-xl max-w-2xl w-full shadow-2xl">
              <h1 className="text-5xl font-bold text-red-400 mb-6 text-center tracking-widest font-vt323">GAME OVER</h1>

              <div className="bg-slate-900 p-6 rounded-lg mb-6">
                <h2 className="text-2xl font-bold text-cyan-400 mb-4 border-b border-slate-600 pb-2">ROOM LEADERBOARD</h2>
                <div className="space-y-2">
                  {roomLeaderboard
                    .sort((a, b) => b.distance - a.distance)
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded ${player.id === (multiplayerId || 'ME')
                          ? 'bg-cyan-900/50 border-2 border-cyan-500'
                          : 'bg-slate-800'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-bold ${index === 0 ? 'text-yellow-400' :
                            index === 1 ? 'text-gray-300' :
                              index === 2 ? 'text-orange-600' : 'text-slate-400'
                            }`}>
                            #{index + 1}
                          </span>
                          <div>
                            <div className="font-bold text-white">
                              {player.id === (multiplayerId || 'ME') ? 'YOU' : player.id.slice(-4)}
                            </div>
                            <div className="text-xs text-slate-400">{player.persona}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-white">{player.distance}m</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {isMultiplayerHost ? (
                  <>
                    <button
                      onClick={() => {
                        // Generate new seed for fresh game
                        const newSeed = Math.random().toString(36).substring(2, 9).toUpperCase();
                        setCurrentSeed(newSeed);
                        setGameKey(k => k + 1);

                        if (mpManagerRef.current) {
                          // Broadcast restart with new seed
                          mpManagerRef.current.broadcast({ type: 'GAME_RESTART' });
                          mpManagerRef.current.broadcast({ type: 'SYNC_SEED', seed: newSeed });
                        }
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setGameState(GameState.WAITING_LOBBY);
                      }}
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl text-xl tracking-widest shadow-lg"
                    >
                      RESTART GAME (重新開始)
                    </button>
                    <button
                      onClick={() => {
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setMultiplayerMode(false);
                        setGameState(GameState.MENU);
                      }}
                      className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg"
                    >
                      EXIT TO MENU (退出)
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-yellow-900/30 border-2 border-yellow-500 p-4 rounded-lg text-center">
                      <p className="text-yellow-400 font-bold text-lg animate-pulse">WAITING FOR HOST TO RESTART...</p>
                      <p className="text-slate-400 text-sm mt-1">等待房主重新開始...</p>
                    </div>
                    <button
                      onClick={() => {
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setMultiplayerMode(false);
                        setGameState(GameState.MENU);
                      }}
                      className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 rounded-lg"
                    >
                      EXIT TO MENU (退出)
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {
        isSpectating && (
          <div className="absolute top-4 right-4 z-[200] pointer-events-auto flex flex-col gap-2">
            <button onClick={() => setIsSpectating(false)} className="bg-red-600 text-white font-bold py-2 px-4 rounded shadow-lg border-2 border-white hover:scale-105 transition-transform">EXIT SPECTATE (退出觀戰)</button>
            <button onClick={handleNextSpectate} className="bg-cyan-600 text-white font-bold py-2 px-4 rounded shadow-lg border-2 border-white hover:scale-105 transition-transform">NEXT PLAYER (下一個玩家)</button>
          </div>
        )
      }

      {
        gameState === GameState.SHOP && (
          <div className="pointer-events-auto absolute inset-0 z-50">
            <Shop money={money} upgrades={upgrades} buyUpgrade={handleBuyUpgrade} onNextLevel={() => setGameState(GameState.CHECKPOINT_SHOP)} ownedItems={ownedItems} equippedItem={equippedItem} buyItem={handleBuyItem} equipItem={handleEquipItem} />
          </div>
        )
      }

      <GameCanvas
        key={gameKey}
        gameState={gameState}
        setGameState={setGameState}
        persona={persona}
        setPersona={setPersona}
        difficulty={difficulty}
        isMobileMode={isMobileMode}
        upgrades={upgrades}
        controls={controlsConfig}
        equippedItem={equippedItem}
        addMoney={(amt) => setMoney(prev => prev + amt)}
        onCrash={handleCrash}
        setFaceStatus={setFaceStatus}
        setVedalMessage={setVedalMessage}
        setStats={(hp, fuel, cargoHp, distance, distToNext, trainX) => setStats(hp, fuel, cargoHp, distance, distToNext, trainX)}
        lastCheckpoint={lastCheckpoint}
        setLastCheckpoint={setLastCheckpoint}
        respawnToken={respawnToken}
        onGrantRandomUpgrade={handleRandomUpgrade}
        setUrgentOrderProgress={setUrgentOrderProgress}
        onUpdateTrajectory={(traj, cargoTraj) => {
          setCurrentTrajectory(traj);
          if (cargoTraj) setCurrentCargoTrajectory(cargoTraj);
        }}
        seed={currentSeed}
        ghostData={ghostData}
        isLayoutEditing={isLayoutEditing}
        multiplayer={{
          isActive: multiplayerMode,
          manager: mpManagerRef.current,
          remotePlayers
        }}
        isSpectating={isSpectating}
        spectatorTargetId={spectatorTargetId}
        setSpectatorTargetId={setSpectatorTargetId}
        mpUpdateRate={mpUpdateRate}
      />

      <SettingsOverlay
        isOpen={showSettings}
        gameState={gameState}
        controls={controlsConfig}
        onUpdateControls={setControlsConfig}
        onResume={() => { setShowSettings(false); setGameState((prev) => prev === GameState.PAUSED ? GameState.PLAYING : prev); }}
        onQuit={() => { setShowSettings(false); setGameState(GameState.MENU); }}
        onDifficultyToggle={() => setDifficulty(prev => prev === 'NORMAL' ? 'EASY' : 'NORMAL')}
        difficulty={difficulty}
        onStartLayoutEdit={() => { setShowSettings(false); setIsLayoutEditing(true); }}
        mpUpdateRate={mpUpdateRate}
        setMpUpdateRate={(rate) => {
          setMpUpdateRate(rate);
          // If we are host (or even if we just want to suggest it), broadcast to room
          // Ideally only Host enforces, but for now let's allow "Democratic Sync" or just Host
          if (mpManagerRef.current) {
            mpManagerRef.current.broadcast({ type: 'SYNC_RATE', rate });
          }
        }}
        multiplayer={{
          isActive: !!multiplayerMode,
          isHost: isMultiplayerHost,
          manager: mpManagerRef.current,
          players: remotePlayers,
          autoJoin: autoJoin,
          onToggleAutoJoin: () => {
            const newVal = !autoJoin;
            setAutoJoin(newVal);
            if (mpManagerRef.current) mpManagerRef.current.autoJoin = newVal;
          }
        }}
        currentSeed={currentSeed}
        onUpdateSeed={(seed) => {
          if (mpManagerRef.current && isMultiplayerHost) {
            mpManagerRef.current.broadcast({ type: 'SYNC_SEED', seed });
            setCurrentSeed(seed);
            setGameState(GameState.MENU);
          }
        }}
        playerName={playerName}
        onUpdateName={(name) => {
          setPlayerName(name);
          if (multiplayerMode && mpManagerRef.current && !isMultiplayerHost) {
            mpManagerRef.current.broadcast({ type: 'PLAYER_READY' });
          } else if (isMultiplayerHost) {
            setPlayerReadyStates(prev => new Map(prev).set(mpManagerRef.current?.myId || 'HOST', true));
          }
        }}
        roomParticipants={roomParticipants}
        persona={persona}
        onUpdatePersona={(p) => {
          setPersona(p);
          if (multiplayerMode && mpManagerRef.current && !isMultiplayerHost) {
            mpManagerRef.current.broadcast({ type: 'PLAYER_READY' });
          } else if (isMultiplayerHost) {
            setPlayerReadyStates(prev => new Map(prev).set(mpManagerRef.current?.myId || 'HOST', true));
          }
        }}
        isMobileMode={isMobileMode}
        onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
        onForceRestart={handleForceRestart}
        initialTab={settingsTab}
      />

      {
        (isLayoutEditing && isMobileMode) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] bg-pink-600 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-bounce pointer-events-auto cursor-pointer" onClick={() => setIsLayoutEditing(false)}>
            DONE EDITING (完成調整)
          </div>
        )
      }

      {
        (gameState === GameState.PLAYING || gameState === GameState.CHECKPOINT_SHOP || gameState === GameState.PAUSED || isLayoutEditing) && (
          <>
            <UIOverlay
              stats={(isSpectating && spectatorTargetId && remotePlayers.get(spectatorTargetId)) ? {
                hp: remotePlayers.get(spectatorTargetId)!.hpPercent ?? 100,
                fuel: remotePlayers.get(spectatorTargetId)!.fuel ?? 100,
                cargoHp: remotePlayers.get(spectatorTargetId)!.cargoHealth ?? 100,
                money: money,
                distance: remotePlayers.get(spectatorTargetId)!.scoreDistance ?? 0,
                distToNext: remotePlayers.get(spectatorTargetId)!.distToNext ?? 0
              } : { ...displayStats, money }}
              gameTime={gameTime}
              faceStatus={faceStatus}
              persona={persona}
              vedalMessage={vedalMessage}
              isMobile={isMobileMode}
              urgentOrderProgress={urgentOrderProgress}
              onAvatarClick={togglePause}
              isFullscreen={isFullscreen}
            />
            {isMobileMode && (
              <MobileControls
                difficulty={difficulty}
                layout={controlsConfig.mobile}
                isEditing={isLayoutEditing}
                onUpdateLayout={(newLayout) => setControlsConfig(prev => ({ ...prev, mobile: newLayout }))}
              />
            )}
          </>
        )
      }

      {
        showAdmin && (
          <div className="absolute top-0 left-0 w-full bg-black/80 p-2 z-[100] border-b-2 border-green-500 font-mono pointer-events-auto">
            <form onSubmit={executeAdminCommand} className="flex gap-2">
              <span className="text-green-500 font-bold">{'>'}</span>
              <input ref={adminInputRef} type="text" value={adminCommand} onChange={(e) => setAdminCommand(e.target.value)} className="bg-transparent border-none outline-none text-green-400 w-full font-bold" />
            </form>
          </div>
        )
      }

      {/* Version Tag */}
      <div className="absolute bottom-1 left-1 z-[1000] text-[8px] text-white/20 font-mono tracking-tighter select-none pointer-events-none uppercase">
        Alpha 1.2k
      </div>
    </div >
  );
};

export default App;
