import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Shop } from './components/Shop';
import { HUDOverlay } from './components/HUDOverlay';
import { MobileControls } from './components/MobileControls';
import { LeaderboardEntry, ControlsConfig, GameState, Persona, UpgradeStats, Vector2, EquipmentId } from './types';
import { INITIAL_MONEY } from './constants';
import { CharacterSelectOverlay } from './components/CharacterSelectOverlay';
import { SoundManager } from './utils/audio';
import { NeuroFace } from './components/NeuroFace';
import { Leaderboard } from './components/Leaderboard';
import { SettingsOverlay } from './components/SettingsOverlay';
import { LoadingScreen } from './components/LoadingScreen';
import { preloadAssets } from './utils/assetLoader';
import { MultiplayerManager, RemotePlayer, MultiplayerEvent } from './utils/multiplayer';
import { InfoTooltip } from './components/InfoTooltip';
import { LoginModal } from './components/LoginModal';
import { UserManagement } from './components/UserManagement';
import { TutorialOverlay } from './components/TutorialOverlay';

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
  // 用户与登录状态
  const [user, setUser] = useState<{ username: string, token: string, saveData: any } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Neural Networks...');
  const [persona, setPersona] = useState<Persona>(Persona.NEURO);
  const [difficulty, setDifficulty] = useState<'NORMAL' | 'EASY'>('NORMAL');
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [diamonds, setDiamonds] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [respawnToken, setRespawnToken] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [finalDistance, setFinalDistance] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [pendingScore, setPendingScore] = useState<{ distance: number, time: number, trajectory?: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[], name?: string } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false); // [UX] Manual trigger for save modal
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);

  // Upgrades & Inventory
  const [upgrades, setUpgrades] = useState<UpgradeStats>({
    engineLevel: 0,
    tankLevel: 0,
    hullLevel: 0,
    cableLevel: 0,
    cargoLevel: 0,
    money: INITIAL_MONEY
  });
  const [ownedItems, setOwnedItems] = useState<EquipmentId[]>(['NONE']);
  const [equippedItem, setEquippedItem] = useState<EquipmentId>('NONE');

  // [NEW] Save Game Function
  const saveGame = useCallback(async (
    currentMoney: number,
    currentDiamonds?: number,
    currentUpgrades?: UpgradeStats,
    currentOwnedItems?: EquipmentId[],
    currentEquippedItem?: EquipmentId
  ) => {
    if (!user) return;
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: user.token,
          saveData: {
            money: currentMoney,
            diamonds: typeof currentDiamonds === 'number' ? currentDiamonds : diamonds,
            upgrades: currentUpgrades || upgrades,
            ownedItems: currentOwnedItems || ownedItems,
            equippedItem: currentEquippedItem || equippedItem
          }
        })
      });
    } catch (e) {
      console.error("Auto-save failed", e);
    }
  }, [user, diamonds, upgrades, ownedItems, equippedItem]);

  // [NEW] 当 dinero 改变时，防抖保存 (这里简化为在关键节点保存，防止频繁请求)
  // 目前策略：Game Over / Shop Close 时保存。但为了通过测试，我们在 setMoney 处不直接保存，而是单独调用。

  // Multiplayer State
  const [multiplayerMode, setMultiplayerMode] = useState<boolean>(false);
  const [multiplayerId, setMultiplayerId] = useState<string | null>(null);
  const [roomToJoin, setRoomToJoin] = useState('');
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const [isMultiplayerHost, setIsMultiplayerHost] = useState(false);
  const mpManagerRef = useRef<MultiplayerManager | null>(null);
  const [managerReady, setManagerReady] = useState(false);

  // New States for Room Admin & Browser
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [roomList, setRoomList] = useState<{ id: string, players: number, seed: string }[]>([]);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [joinApproved, setJoinApproved] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [autoJoin, setAutoJoin] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('neuro_drone_name') || `Drone-${Math.floor(1000 + Math.random() * 9000)}`);
  const [nameError, setNameError] = useState<string | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<{ id: string, name: string }[]>([]);

  const handleUpdateName = useCallback(async (name: string) => {
    // [LOCK] 登入後或死亡待存檔期間，禁止修改名稱
    if (user?.username || (pendingScore && pendingScore.name)) {
      setVedalMessage(user?.username ? "已登入帳號，無法修改名稱。" : "成績結算中，無法修改名稱。");
      return;
    }

    setPlayerName(name);
    localStorage.setItem('neuro_drone_name', name);
    setNameError(null);
    setVedalMessage("");

    if (!user && name.length > 0) {
      try {
        const res = await fetch('/api/check-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name })
        });
        const data = await res.json();
        if (data && data.exists) {
          setNameError("此暱稱已被註冊。訪客請更換名稱。");
          setVedalMessage("偵測到身份冒用... 請更換暱稱。");
        }
      } catch (e) {
        console.error("Name check failed", e);
      }
    }
  }, [user, pendingScore]);

  const [showAdmin, setShowAdmin] = useState(false);

  // [NEW] Check name conflict or verification token for persistence
  useEffect(() => {
    const savedToken = localStorage.getItem('neuro_drone_token');

    if (savedToken) {
      // Try to verify token
      fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      })
        .then(res => res.json())
        .then(u => {
          if (u.success) {
            setUser({ token: savedToken, username: u.username, saveData: u.saveData, role: u.role });
            setMoney(u.saveData.money);
            setDiamonds(u.saveData.diamonds || 0);
            if (u.saveData.upgrades) setUpgrades(u.saveData.upgrades);
            if (u.saveData.ownedItems) setOwnedItems(u.saveData.ownedItems);
            if (u.saveData.equippedItem) setEquippedItem(u.saveData.equippedItem);
            setPlayerName(u.username);
            setIsAdmin(u.role === 'admin');
            setNameError(null);
            setShowLogin(false); // Hide login modal if auto-logged in
          } else {
            localStorage.removeItem('neuro_drone_token');
            // If token invalid, proceed as guest to check name
            if (playerName) {
              fetch('/api/check-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: playerName })
              })
                .then(res => res.json())
                .then(data => {
                  if (data && data.exists) {
                    setNameError("此暱稱已被註冊。訪客請更換名稱。");
                    setVedalMessage("偵測到身份冒用... 請更換暱稱。");
                  }
                })
                .catch(e => console.error("Initial name check failed", e));
            }
          }
        })
        .catch(e => {
          console.error("Verify token failed", e);
          localStorage.removeItem('neuro_drone_token');
          // If API call fails, proceed as guest to check name
          if (playerName) {
            fetch('/api/check-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: playerName })
            })
              .then(res => res.json())
              .then(data => {
                if (data && data.exists) {
                  setNameError("此暱稱已被註冊。訪客請更換名稱。");
                  setVedalMessage("偵測到身份冒用... 請更換暱稱。");
                }
              })
              .catch(e => console.error("Initial name check failed", e));
          }
        });
    } else if (!user && playerName) {
      fetch('/api/check-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.exists) {
            setNameError("此暱稱已被註冊。訪客請更換名稱。");
            setVedalMessage("偵測到身份冒用... 請更換暱稱。");
          }
        })
        .catch(e => console.error("Initial name check failed", e));
    }
  }, []); // Run only once on mount
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

  // [RESTORED] Missing States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vedalMessage, setVedalMessage] = useState<string>('');
  const [faceStatus, setFaceStatus] = useState<'idle' | 'panic' | 'win' | 'dead'>('idle');
  const [urgentOrderProgress, setUrgentOrderProgress] = useState<{ percent: number, timeLeft: number } | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<Vector2>({ x: 200, y: 860 });
  const [currentSeed, setCurrentSeed] = useState<string>('');
  const [isChallengingSeed, setIsChallengingSeed] = useState(false);
  const [ghostData, setGhostData] = useState<{ trajectory: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[], name: string } | null>(null);

  // Trajectory State
  const [currentTrajectory, setCurrentTrajectory] = useState<{ x: number, y: number }[]>([]);
  const [currentCargoTrajectory, setCurrentCargoTrajectory] = useState<{ x: number, y: number }[]>([]);

  // Game Over Action
  const [postScoreAction, setPostScoreAction] = useState<'NONE' | 'SAVING' | 'SAVED' | null>('NONE');


  // Mobile Mode - Automatic Detection & Persistence
  const [isMobileMode, setIsMobileMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('neuro_drone_mobile_mode');
    if (saved !== null) return saved === 'true';

    // Initial Auto detection
    const isTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    const isUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 1024; // Check width too
    return isTouch || isUA || isSmallScreen;
  });

  // [FIX] Listen for resize to auto-detect mobile mode (if not manually overridden)
  useEffect(() => {
    const handleResize = () => {
      if (localStorage.getItem('neuro_drone_mobile_mode') === null) {
        const isSmallScreen = window.innerWidth < 1024;
        const isTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
        setIsMobileMode(isSmallScreen || isTouch);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleMobileMode = useCallback(() => {
    setIsMobileMode(prev => {
      const next = !prev;
      localStorage.setItem('neuro_drone_mobile_mode', String(next));
      return next;
    });
  }, []);

  // Stats for UI Display
  const [displayStats, setDisplayStats] = useState({
    hp: 100,
    fuel: 100,
    cargoHp: 100,
    distance: 0,
    distToNext: 0,
    speed: 0,
    equippedItem: 'NONE' as EquipmentId,
    trainX: 0,
    isBursting: false
  });


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

  // [插值優化] 每幀更新遠程玩家位置,平滑過渡到目標位置
  useEffect(() => {
    if (!multiplayerMode) return;

    let animationId: number;
    const interpolate = () => {
      setRemotePlayers(prev => {
        const next = new Map(prev);
        let hasChanges = false;

        prev.forEach((player, id) => {
          if (!player.targetPos) return;

          const lerpFactor = 0.3; // 插值速度

          // 位置插值
          const newX = player.pos.x + (player.targetPos.x - player.pos.x) * lerpFactor;
          const newY = player.pos.y + (player.targetPos.y - player.pos.y) * lerpFactor;

          // 角度插值
          let angleDiff = (player.targetAngle || player.angle) - player.angle;
          if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const newAngle = player.angle + angleDiff * lerpFactor;

          // 貨物位置插值
          let newCargoX = player.cargoPos?.x || 0;
          let newCargoY = player.cargoPos?.y || 0;
          if (player.targetCargoPos && player.cargoPos) {
            newCargoX = player.cargoPos.x + (player.targetCargoPos.x - player.cargoPos.x) * lerpFactor;
            newCargoY = player.cargoPos.y + (player.targetCargoPos.y - player.cargoPos.y) * lerpFactor;
          }

          // 貨物角度插值
          let newCargoAngle = player.cargoAngle || 0;
          if (player.targetCargoAngle !== undefined && player.cargoAngle !== undefined) {
            let cargoAngleDiff = player.targetCargoAngle - player.cargoAngle;
            if (cargoAngleDiff > Math.PI) cargoAngleDiff -= Math.PI * 2;
            if (cargoAngleDiff < -Math.PI) cargoAngleDiff += Math.PI * 2;
            newCargoAngle = player.cargoAngle + cargoAngleDiff * lerpFactor;
          }

          // 檢查是否有變化
          if (Math.abs(newX - player.pos.x) > 0.01 || Math.abs(newY - player.pos.y) > 0.01) {
            hasChanges = true;
            next.set(id, {
              ...player,
              pos: { x: newX, y: newY },
              angle: newAngle,
              cargoPos: player.cargoPos ? { x: newCargoX, y: newCargoY } : undefined,
              cargoAngle: newCargoAngle
            });
          }
        });

        return hasChanges ? next : prev;
      });

      animationId = requestAnimationFrame(interpolate);
    };

    animationId = requestAnimationFrame(interpolate);
    return () => cancelAnimationFrame(animationId);
  }, [multiplayerMode]);

  // Custom Controls State
  const [controlsConfig, setControlsConfig] = useState<ControlsConfig>(DEFAULT_CONTROLS);
  const [isLayoutEditing, setIsLayoutEditing] = useState(false);

  useEffect(() => {
    const handleFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  // Try to enter fullscreen on first user interaction (user gesture required).
  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as any;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          await req.call(el);
          setIsFullscreen(!!document.fullscreenElement);
        }
      }
    } catch (e) {
      console.warn('Enter fullscreen failed', e);
    }
  };

  useEffect(() => {
    const onFirstInteract = async () => {
      await enterFullscreen();
    };
    // Use once option so this only fires on the first gesture
    window.addEventListener('pointerdown', onFirstInteract, { once: true });
    return () => window.removeEventListener('pointerdown', onFirstInteract as any);
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
      "正在校準陀螺儀...",
      "優化神經網路路徑...",
      "正在擦亮蘭姆酒瓶...",
      "Evil 正在準備嘲諷...",
      "計算最佳配送路徑...",
      "正在用咖啡賄賂 Vedal...",
      "正在載入烏龜群..."
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
      setVedalMessage("連線功能準備就緒！");
    } else if (event.type === 'PLAYER_JOINED') {
      setVedalMessage("有新的無人機進入空域！");
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
          setVedalMessage("你已被房主踢出房間。");
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
          const existing = prev.get(playerId);

          // [插值優化] 將新位置設為目標,而非直接更新
          next.set(playerId, {
            id: playerId,
            // 保持當前位置(如果存在),否則直接設置
            pos: existing?.pos || event.data.pos,
            angle: existing?.angle || event.data.angle,
            cargoPos: existing?.cargoPos || event.data.cargoPos,
            cargoAngle: existing?.cargoAngle || event.data.cargoAngle,
            // 設置目標位置
            targetPos: event.data.pos,
            targetAngle: event.data.angle,
            targetCargoPos: event.data.cargoPos,
            targetCargoAngle: event.data.cargoAngle,
            // 其他狀態直接更新
            health: event.data.health,
            persona: event.data.persona,
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
          setVedalMessage(`房主調整同步頻率為: ${event.data.rate.toUpperCase()}`);
        }
      } else if (event.data.type === 'SYNC_SEED') {
        setVedalMessage("房主同步了世界種子！");
        setCurrentSeed(event.data.seed);
        setLastCheckpoint({ x: 200, y: 860 }); // Reset checkpoint on new seed/restart
        setGameState(prev => {
          if (prev !== GameState.WAITING_LOBBY && prev !== GameState.PLAYING) {
            return GameState.MENU;
          }
          return prev;
        });
      } else if (event.data.type === 'GAME_START') {
        // [FIX] Full state reset on game start (same as handleStart for single player)
        setGameKey(k => k + 1);
        setLastCheckpoint({ x: 200, y: 860 });
        setUrgentOrderProgress(null);
        setGameTime(0);
        setCurrentTrajectory([]);
        setCurrentCargoTrajectory([]);
        setIsSpectating(false);
        setShowSettings(false);
        setShowSaveModal(false);
        setAllPlayersDead(false);
        setIsPermanentlyDead(false);
        setRoomLeaderboard([]);
        setGameState(GameState.PLAYING);
        setVedalMessage("房主開始了遊戲！");
      } else if (event.data.type === 'GAME_RESTART') {
        // Go to Lobby instead of Playing
        setGameState(GameState.WAITING_LOBBY);
        setAllPlayersDead(false);
        setRoomLeaderboard([]);
        setLastCheckpoint({ x: 200, y: 860 });
        setVedalMessage("房主重啟了遊戲！");
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
        setVedalMessage("任務結束。所有無人機皆已墜毀。");
      } else if (event.data.type === 'GAME_RESTART') {
        // Host restarted the game - reset everything
        setAllPlayersDead(false);
        setIsPermanentlyDead(false);
        setRoomLeaderboard([]);
        setGameKey(k => k + 1);
        setGameState(GameState.WAITING_LOBBY);
        setVedalMessage("房主重新開始了遊戲！");
      } else if (event.data.type === 'JOIN_APPROVED') {
        setWaitingApproval(false);
        setJoinApproved(true);
        setVedalMessage("房主已批准加入！");
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
      setVedalMessage(`錯誤：${event.message}`);
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
      setManagerReady(true);
    }

    return () => {
      if (!multiplayerMode && mpManagerRef.current) {
        mpManagerRef.current.disconnect();
        mpManagerRef.current = null;
        setManagerReady(false);
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

  const handleLogout = () => {
    localStorage.removeItem('neuro_drone_token');
    setUser(null);
    setIsAdmin(false);
    setIsGuest(true);
    // Keep local name for convenience but clear error since they are guest now
    setNameError(null);
    setVedalMessage("已登出系統。");
    // Re-trigger name check as guest (bypass handleUpdateName since user state hasn't updated yet)
    if (playerName && playerName.length > 0) {
      fetch('/api/check-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: playerName })
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.exists) {
            setNameError("此暱稱已被註冊。訪客請更換名稱。");
            setVedalMessage("偵測到身份冒用... 請更換暱稱。");
          }
        })
        .catch(e => console.error("Logout name check failed", e));
    }
  };

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
    // [SAFETY] Double check name conflict for guests
    if (!user && nameError) {
      setVedalMessage(`無法啟動任務：${nameError}`);
      return;
    }
    // If somehow nameError persisted after login, clear it
    if (user && nameError) {
      setNameError(null);
    }
    if (multiplayerMode && mpManagerRef.current) {
      mpManagerRef.current.myName = playerName;
    }
    SoundManager.init();
    SoundManager.startWind();
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
    } else if (multiplayerMode) {
      // [FIX] In multiplayer, don't generate a random seed here.
      // Host will generate and broadcast seed below, client already has seed from SYNC_SEED.
      setIsChallengingSeed(false);
      setGhostData(null);
    } else if (gameState !== GameState.MENU) {
      setCurrentSeed(Math.random().toString(36).substring(2, 9).toUpperCase());
      setIsChallengingSeed(false);
      setGhostData(null);
    } else {
      // [FIX] Ensure a seed is generated when starting from MENU
      setCurrentSeed(Math.random().toString(36).substring(2, 9).toUpperCase());
      setIsChallengingSeed(false);
      setGhostData(null);
    }

    // Multiplayer Flow: Enter Lobby first
    if (multiplayerMode) {
      if (!isMultiplayerHost && !joinApproved) {
        setVedalMessage("請先加入房間並等待批准。");
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
      setGameKey(k => k + 1);
      setGameState(GameState.WAITING_LOBBY);
      setIsReady(true); // 选择角色即视为准备
      if (mpManagerRef.current && !isMultiplayerHost) {
        mpManagerRef.current.broadcast({ type: 'PLAYER_READY' });
      }
      return;
    } else {
      setGameKey(k => k + 1);
      setGameState(GameState.PLAYING);
    }

    setUrgentOrderProgress(null);
    setGameTime(0);
    setCurrentTrajectory([]);
    setCurrentCargoTrajectory([]);
    setIsSpectating(false);
    setShowSettings(false); // Force close settings
    setShowSaveModal(false); // [FIX] Ensure save modal is closed on start
  };

  const setStats = useCallback((hp: number, fuel: number, cargoHp: number, distance: number, distToNext: number, speed: number, equippedItem: EquipmentId, trainX?: number, isBursting?: boolean) => {
    setDisplayStats({
      hp, fuel, cargoHp, distance, distToNext, speed, equippedItem, trainX: trainX ?? 0, isBursting: isBursting ?? false
    });
    // Elimination Mode Check: If train passed current checkpoint while in Game Over
    if (gameState === GameState.GAME_OVER && multiplayerMode && trainX !== undefined && !isPermanentlyDead) {
      if (trainX >= lastCheckpoint.x) {
        setIsPermanentlyDead(true);
        setVedalMessage("存檔點已被發燒列車吞噬！無法重生。");
      }
    }
  }, [gameState, multiplayerMode, lastCheckpoint.x, isPermanentlyDead]);

  const handleRedeemCode = (code: string) => {
    if (!user) return;
    fetch('/api/redeem-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: user.token, code })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsAdmin(true);
          setUser({ ...user, role: 'admin' });
          setVedalMessage("邀請碼兌換成功！已獲得管理員權限。");
        } else {
          setVedalMessage(`兌換失敗：${data.error}`);
        }
      })
      .catch(e => {
        console.error("Redeem failed", e);
        setVedalMessage("兌換失敗：連線異常。");
      });
  };

  const saveToLeaderboard = async (name: string, distance: number, time: number, trajectory?: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[]) => {
    console.log(`[Leaderboard] Saving score for ${name}. Trajectory length: ${trajectory?.length || 0}`);
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
      setShowSaveModal(false);

      if (postScoreAction === 'RESTART') handleStart();
      else if (postScoreAction === 'MENU') {
        setShowSettings(false);
        setGameState(GameState.MENU);
      }
      setPostScoreAction(null);
    } catch (e) {
      console.error("Failed to save score", e);
    }
  };

  // Game Over Effect (Simplified - removed pendingScore logic)
  useEffect(() => {
    if (gameState === GameState.GAME_OVER && !multiplayerMode) {
      // 检查是否打破记录 (Logic moved to handleCrash to fix Ghost race condition)
    }
  }, [gameState, multiplayerMode]);

  const handleBackToMenu = () => {
    if (finalDistance > 0 || displayStats.distance > 0) {
      const dist = finalDistance || displayStats.distance;
      const time = gameTime;
      setPostScoreAction('MENU');
      setShowSaveModal(true); // Manually returning to menu triggers save modal immediately
      const trajSnap = (window as any).gameRefs?.currentTrajectory || currentTrajectory;
      const cargoTrajSnap = (window as any).gameRefs?.currentCargoTrajectory || currentCargoTrajectory;
      setPendingScore({
        distance: dist,
        time: time,
        trajectory: trajSnap ? [...trajSnap] : [],
        cargoTrajectory: cargoTrajSnap ? [...cargoTrajSnap] : [],
        name: playerName // [LOCK] Capture current name at moment of death
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
    setGameState(GameState.PLAYING);
    setUrgentOrderProgress(null);
    setIsSpectating(false);
    setShowSaveModal(false); // [FIX] Ensure save modal is closed on respawn
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
        setVedalMessage("存檔點已被發燒列車吞噬！無法重生。");
      } else if (trainX < lastCheckpoint.x - 400) {
        // [CASE 3] Safe -> Auto Respawn
        handleRespawn();
        setVedalMessage("Neuro 重組完成！存檔點安全。");
        return;
      } else {
        // [CASE 2] Danger Zone (Train is approaching checkpoint)
        // Show Game Over screen to break the infinite death loop
        setVedalMessage("警告：火車逼近！請小心重生！");
        // Fall through to normal GAME_OVER to allow manual respawn
      }
    }

    SoundManager.play('crash');
    setGameState(GameState.GAME_OVER);
    setShowSaveModal(false); // [FIX] Ensure modal doesn't pop up automatically
    if (multiplayerMode) setIsSpectating(true); // 死亡后自动开启观战
    setFinalDistance(finalDist);
    const penalty = 50;
    setMoney(prev => {
      const newVal = Math.max(0, prev - penalty);
      saveGame(newVal); // Auto-save on death penalty
      return newVal;
    });
    // Sync upgrades money state as well
    setUpgrades(prev => ({ ...prev, money: Math.max(0, prev.money - penalty) }));

    setVedalMessage(`任務失敗。扣除 $${penalty} 手續費。`);

    const TAUNTS: any = {
      WALL: ["倒楣。", "喔噗。", "變扁了。"],
      LASER: ["烤焦了。", "中電！", "五分熟。"],
      FUEL: ["乾了。", "沒氣了。", "該走路了？"],
      CARGO: ["打破了。", "退貨中。", "主人要生氣了。"],
      VOID: ["迷失了。", "深不可測。", "掰掰。"],
      TRAIN: ["火車快跑！", "被輾過了。", "請出示車票？"]
    };
    const DEATH_DISPLAY_NAMES: any = { WALL: "撞擊", LASER: "雷射", FUEL: "沒油", CARGO: "貨損", VOID: "深淵", TRAIN: "遭列車輾斃" };

    const list = TAUNTS[reason] || TAUNTS['WALL'];
    const taunt = list[Math.floor(Math.random() * list.length)];
    setDeathDetails({ reason, reasonDisplay: DEATH_DISPLAY_NAMES[reason] || reason, taunt });

    if (finalDist > highScore) setHighScore(finalDist);
    setCurrentTrajectory(trajectory || []);
    setCurrentCargoTrajectory(cargoTrajectory || []);

    // [FIX] Directly set pending score here to avoid race conditions with useEffect
    if (!multiplayerMode) {
      if (finalDist > highScore || (leaderboard.length < 100 || finalDist > leaderboard[leaderboard.length - 1].distance)) {
        setPostScoreAction(null);
        setPendingScore({
          distance: finalDist,
          time: gameTime,
          trajectory: trajectory ? [...trajectory] : [],
          cargoTrajectory: cargoTrajectory ? [...cargoTrajectory] : [],
          name: playerName // [LOCK] Capture current name at moment of death
        });
      }
    }

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
      const nextMoney = money - cost;
      const nextUpgrades = { ...upgrades, [type]: (upgrades[type] as number) + 1 };
      setMoney(nextMoney);
      setUpgrades(nextUpgrades);
      if (user) saveGame(nextMoney, diamonds, nextUpgrades);
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
      const nextMoney = money - cost;
      const nextOwned = [...ownedItems, item];
      setMoney(nextMoney);
      setOwnedItems(nextOwned);
      setEquippedItem(item);
      if (user) saveGame(nextMoney, diamonds, upgrades, nextOwned, item);
    }
  };

  const handleEquipItem = (item: EquipmentId) => {
    SoundManager.play('shop');
    setEquippedItem(item);
    if (user) saveGame(money, diamonds, upgrades, ownedItems, item);
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

  const handleRestartFull = () => {
    // [UX] Intercept restart if there is a pending high score
    if (pendingScore && !multiplayerMode) {
      setPostScoreAction('RESTART');
      setShowSaveModal(true);
      return;
    }
    handleStart();
  };


  const handleBuyRefuel = () => {
    if (money >= 20) {
      SoundManager.play('coin');
      const nextMoney = money - 20;
      setMoney(nextMoney);
      if (user) saveGame(nextMoney);
      const refs = (window as any).gameRefs;
      if (refs?.drone) refs.drone.fuel = refs.drone.maxFuel;
      return true;
    }
    return false;
  };

  const handleBuyRepair = () => {
    if (money >= 30) {
      SoundManager.play('coin');
      const nextMoney = money - 30;
      setMoney(nextMoney);
      if (user) saveGame(nextMoney);
      const refs = (window as any).gameRefs;
      if (refs?.drone) refs.drone.health = refs.drone.maxHealth;
      return true;
    }
    return false;
  };

  const handleLaunchFromShop = () => {
    SoundManager.play('shop');
    if (user) saveGame(money);
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
      {/* Fullscreen prompt (shows when not fullscreen) */}
      {!isFullscreen && (
        <div className="fixed top-7 left-4 z-[9999]">
          <button
            onClick={(e) => { e.stopPropagation(); enterFullscreen(); }}
            className="bg-white/10 hover:bg-white/20 backdrop-blur text-cyan-300 border border-cyan-500/30 px-6 py-2 rounded-none skew-x-[-12deg] font-black italic tracking-wider transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            title="進入全螢幕"
          >
            <span className="skew-x-[12deg] inline-block">進入全螢幕</span>
          </button>
        </div>
      )}

      {gameState === GameState.LOADING && (
        <LoadingScreen progress={loadingProgress} message={loadingMessage} />
      )}

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden font-sans select-none">
          {/* Global Background Tech Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px] opacity-20 z-0" />

          {/* User Profile / Login Status - Top Right */}
          <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2">
            {!user ? (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-white/10 hover:bg-white/20 backdrop-blur text-cyan-300 border border-cyan-500/30 px-6 py-2 rounded-none skew-x-[-12deg] font-black italic tracking-wider transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                data-tutorial-target="login-btn"
              >
                <span className="skew-x-[12deg] inline-block">LOGIN // 登入</span>
              </button>
            ) : (<>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur border-r-4 border-cyan-500 px-6 py-2 skew-x-[-12deg] shadow-lg">
                  <div className="skew-x-[12deg] flex flex-col items-end">
                    <span className="text-xs text-cyan-500 font-mono tracking-widest">OPERATOR</span>
                    <span className="text-xl font-black italic text-white tracking-widest uppercase">{user.username}</span>
                  </div>
                </div>
              </div>


              {/* NEW Currency UI - Integrated under Profile */}
              <div className="flex items-center gap-2 mt-1">
                {/* Diamonds */}
                {(diamonds > 0 || isAdmin) && (
                  <div className="bg-slate-900/60 backdrop-blur border-b-2 border-cyan-500/50 px-3 py-1 skew-x-[-12deg] flex items-center gap-2" title="Diamonds">
                    <div className="skew-x-[12deg] flex items-center gap-1">
                      <span className="text-lg">💎</span>
                      <span className="text-cyan-300 font-bold font-mono text-sm leading-none pt-0.5">{diamonds}</span>
                    </div>
                  </div>
                )}
                {/* Money */}
                <div className="bg-slate-900/60 backdrop-blur border-b-2 border-yellow-500/50 px-4 py-1 skew-x-[-12deg] flex items-center gap-2" title="Credits" data-tutorial-target="currency-display">
                  <div className="skew-x-[12deg] flex items-center gap-1">
                    <span className="text-yellow-400 font-black italic text-sm tracking-wider">CREDITS</span>
                    <span className="text-white font-mono font-bold text-sm leading-none pt-0.5">${money.toLocaleString()}</span>
                  </div>
                </div>
              </div>


            </>)}
          </div>

          {/* MAIN MENU CONTENT */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4">
            {/* Title Section */}
            <div className="mb-10 text-center group cursor-pointer" onClick={() => setShowSettings(true)} data-tutorial-target="settings-title">
              <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(6,182,212,0.6)] animate-pulse-slow">
                NEURO'S <span className="text-cyan-400">DRONE</span>
              </h1>
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="h-0.5 w-12 bg-cyan-500/50" />
                <h2 className="text-xl md:text-2xl font-bold tracking-[0.5em] text-cyan-200/80">DELIVERY SERVICE</h2>
                <div className="h-0.5 w-12 bg-cyan-500/50" />
              </div>
              <div className="mt-2 text-xs font-mono text-slate-500 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                CLICK TO CONFIGURE SYSTEM // 點擊設定
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-stretch">

              {/* LEFT COLUMN: Operations */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Callsign / Name Input */}
                <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-4 skew-x-[-6deg] hover:border-cyan-500/50 transition-colors">
                  <div className="skew-x-[6deg]">
                    <div className="text-[10px] text-cyan-500 font-mono tracking-[0.3em] mb-2">CALLSIGN // 代號</div>
                    {user ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black italic text-white tracking-widest flex-1">{user.username}</span>
                        <span className="text-[10px] text-green-500 font-mono tracking-widest">🔒 REGISTERED</span>
                      </div>
                    ) : (
                      <div className="relative group/name">
                        <input
                          type="text"
                          value={playerName}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 12);
                            handleUpdateName(val);
                          }}
                          placeholder="ENTER CALLSIGN..."
                          maxLength={12}
                          className="w-full bg-transparent border-b-2 border-slate-700 focus:border-cyan-400 text-xl font-black italic text-white tracking-widest outline-none py-1 transition-colors placeholder:text-slate-700 placeholder:font-normal placeholder:not-italic"
                        />
                        {nameError && (
                          <div className="text-red-400 text-[10px] font-mono mt-1 tracking-wider">{nameError}</div>
                        )}
                        <div className="text-[10px] text-slate-600 font-mono mt-1 tracking-wider">GUEST MODE — <span className="text-cyan-600 cursor-pointer hover:text-cyan-400" onClick={() => setShowLogin(true)}>LOGIN FOR PERMANENT ID</span></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multiplayer Panel */}
                <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 skew-x-[-6deg] hover:border-cyan-500/50 transition-colors group">
                  <div className="skew-x-[6deg]">
                    <h3 className="text-cyan-400 font-black italic text-xl mb-4 flex items-center gap-2">
                      <span className="w-2 h-6 bg-cyan-500 block"></span>
                      MULTIPLAYER // 多人連線
                    </h3>

                    <label className="flex items-center gap-3 cursor-pointer mb-4 hover:opacity-80 transition-opacity" onClick={() => setMultiplayerMode(!multiplayerMode)} data-tutorial-target="mp-toggle">
                      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${multiplayerMode ? 'bg-green-500' : 'bg-slate-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${multiplayerMode ? 'translate-x-6' : ''}`} />
                      </div>
                      <span className={`font-bold font-mono text-sm ${multiplayerMode ? 'text-green-400' : 'text-slate-400'}`}>
                        {multiplayerMode ? 'ONLINE ACTIVE' : 'OFFLINE'}
                      </span>
                    </label>

                    {multiplayerMode && (
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <div className="flex-1 bg-slate-800 p-2 border border-slate-600">
                            <span className="text-[10px] text-slate-400 block tracking-wider">YOUR ID</span>
                            <div className="text-cyan-400 font-mono font-bold tracking-widest cursor-pointer hover:text-white truncate"
                              onClick={() => { if (mpManagerRef.current?.myId) { navigator.clipboard.writeText(mpManagerRef.current.myId); setVedalMessage("ID COPIED"); } }}>
                              {mpManagerRef.current?.myId || 'CONNECTING...'}
                            </div>
                            <button
                              onClick={() => { if (mpManagerRef.current?.myId) { navigator.clipboard.writeText(mpManagerRef.current.myId); setVedalMessage("ID COPIED"); } }}
                              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                            >
                              複製
                            </button>
                          </div>
                          <button
                            disabled={!multiplayerId}
                            onClick={() => {
                              if (mpManagerRef.current) {
                                mpManagerRef.current.host();
                                setIsMultiplayerHost(true);
                                setJoinApproved(true);
                                setVedalMessage("創建房間成功。分享你的 ID！");
                                setRoomParticipants([{ id: mpManagerRef.current.myId || 'HOST', name: playerName }]);
                                setPlayerReadyStates(new Map([[mpManagerRef.current.myId || 'HOST', true]]));
                                setIsReady(true);
                              }
                            }}
                            className={`flex-1 py-3 bg-cyan-900/50 hover:bg-cyan-800/80 border border-cyan-500/30 text-cyan-200 font-bold text-xs tracking-wider transition-all active:scale-95 ${isMultiplayerHost ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : ''}`}
                          >
                            {isMultiplayerHost ? 'HOSTING...' : 'CREATE ROOM'}
                          </button>
                          <button
                            onClick={() => {
                              setShowRoomBrowser(true);
                              MultiplayerManager.getRooms().then(setRoomList);
                            }}
                            className="flex-1 py-3 bg-purple-900/50 hover:bg-purple-800/80 border border-purple-500/30 text-purple-200 font-bold text-xs tracking-wider transition-all active:scale-95"
                          >
                            BROWSE ROOMS
                          </button>
                        </div>

                        <div className="bg-slate-900/40 backdrop-blur border-t-2 border-cyan-500/30 p-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-xs text-cyan-500 font-mono">CONNECTION STATUS</div>
                            {user && (
                              <div className="text-xs text-green-400 font-bold flex items-center gap-1">
                                <span>●</span> {user.username}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 relative">
                              <input
                                type="text"
                                placeholder="ROOM ID"
                                value={roomToJoin}
                                onChange={(e) => setRoomToJoin(e.target.value.toUpperCase())}
                                className="flex-1 bg-black/40 border border-slate-600 text-white font-mono text-sm px-3 py-2 outline-none focus:border-cyan-500 transition-colors uppercase placeholder:text-slate-600"
                              />
                              <button
                                onClick={() => {
                                  if (roomToJoin) {
                                    mpManagerRef.current?.join(roomToJoin.startsWith('NEURO-') ? roomToJoin : `NEURO-${roomToJoin}`, playerName);
                                    setIsMultiplayerHost(false);
                                    setWaitingApproval(true);
                                    setJoinApproved(false);
                                  }
                                }}
                                className="bg-pink-600 hover:bg-pink-500 text-white px-4 font-black italic tracking-tighter skew-x-[-12deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(219,39,119,0.4)]"
                              >
                                <span className="skew-x-[12deg] inline-block">JOIN</span>
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>

                {/* System Controls (Global) */}
                <div className="flex gap-4">
                  <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-4 skew-x-[-6deg] hover:border-green-500/50 transition-colors cursor-pointer group"
                    onClick={() => setDifficulty(d => d === 'NORMAL' ? 'EASY' : 'NORMAL')}>
                    <div className="skew-x-[6deg] flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold tracking-widest mb-1">CONTROL SYSTEM</span>
                      <div className={`text-lg font-black italic transition-colors ${difficulty === 'EASY' ? 'text-green-400' : 'text-slate-300'}`}>
                        {difficulty === 'EASY' ? 'EASY / 簡單' : 'MANUAL / 普通'}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-4 skew-x-[-6deg] hover:border-pink-500/50 transition-colors cursor-pointer group"
                    onClick={() => setIsMobileMode(!isMobileMode)}>
                    <div className="skew-x-[6deg] flex flex-col">
                      <span className="text-[10px] text-slate-500 font-bold tracking-widest mb-1">INTERFACE</span>
                      <div className={`text-lg font-black italic transition-colors ${isMobileMode ? 'text-pink-400' : 'text-slate-300'}`}>
                        {isMobileMode ? 'TOUCH / 觸控' : 'DESKTOP / 鍵盤'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* RIGHT COLUMN: Action */}
              <div className="flex-1 flex flex-col gap-4 justify-center" data-tutorial-target="start-btn-neuro">
                {multiplayerMode && !isMultiplayerHost && waitingApproval ? (
                  <div className="h-full min-h-[160px] bg-slate-900/80 backdrop-blur border-2 border-yellow-500/50 flex flex-col items-center justify-center skew-x-[-6deg] animate-pulse">
                    <div className="skew-x-[6deg] text-center">
                      <div className="text-yellow-400 font-bold text-xl tracking-widest mb-2">WAITING FOR AUTHS</div>
                      <div className="text-xs text-yellow-600 font-mono">等待房主批准...</div>
                    </div>
                  </div>
                ) : multiplayerMode && !isMultiplayerHost && !joinApproved ? (
                  <div className="h-full min-h-[160px] bg-slate-900/80 backdrop-blur border-2 border-slate-700 flex flex-col items-center justify-center skew-x-[-6deg] opacity-50">
                    <div className="skew-x-[6deg] text-center">
                      <div className="text-slate-400 font-bold text-xl tracking-widest mb-2">LINK REQUIRED</div>
                      <div className="text-xs text-slate-600 font-mono">請先加入房間</div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCharacterSelect(true)}
                    className="group relative h-full min-h-[160px] bg-white text-slate-950 font-black italic skew-x-[-6deg] transition-all hover:bg-cyan-400 hover:scale-[1.02] active:scale-[0.98] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[url('/assets/conceptart/neuro.png')] opacity-10 bg-cover bg-center mix-blend-multiply group-hover:scale-110 transition-transform duration-700" />
                    <div className="skew-x-[6deg] relative z-20 flex flex-col items-center gap-1">
                      <span className="text-5xl md:text-7xl tracking-tighter">SORTIE</span>
                      <span className="text-lg font-bold tracking-[0.5em] opacity-60 group-hover:opacity-100 transition-opacity">出擊確認</span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 ease-out" />
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setShowUserMgmt(true)}
                    className="bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 font-bold py-3 skew-x-[-6deg] border border-purple-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <div className="skew-x-[6deg] flex items-center gap-2 text-xs tracking-widest">
                      <span>🛡️</span> SYSTEM ADMIN // 管理後台
                    </div>
                  </button>
                )}

                {/* High Score Panel */}
                <div className="mt-auto bg-slate-900/40 backdrop-blur border-t-2 border-cyan-500/30 p-4">
                  <div className="text-xs text-cyan-500 font-mono mb-1">RECORD DISTANCE</div>
                  <div className="text-3xl font-black italic text-white flex items-baseline gap-2">
                    {highScore} <span className="text-sm font-normal text-slate-400">m</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1 cursor-pointer hover:text-cyan-400" onClick={() => setShowLeaderboard(true)} data-tutorial-target="leaderboard-card">VIEW LEADERBOARD // 查看榜單 →</div>
                </div>
              </div>
            </div>

            {/* Footer Status */}
            <div className="mt-12 flex w-full justify-between items-end opacity-30 font-mono text-[10px] tracking-widest uppercase text-white select-none">
              <div>SYS.VER: 2.0.0-ALPHA</div>
              <div>SECURE CONNECTION // ESTABLISHED</div>
            </div>
          </div>
        </div >
      )
      }
      {/* Tutorial/Controls Hint (Menu Only - Hover/Long Press) */}
      {
        gameState === GameState.MENU && !showTutorial && !showSettings && (
          <div className="absolute bottom-6 right-6 z-[60] group cursor-help" data-tutorial-target="tutorial-btn">
            {/* Trigger Icon */}
            <div className="w-10 h-10 rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center text-slate-400 font-bold hover:bg-cyan-900/80 hover:border-cyan-500 hover:text-cyan-400 transition-all backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              ?
            </div>

            {/* Popup Hints */}
            <div className="absolute bottom-full right-0 mb-4 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity pointer-events-none skew-x-[-6deg] origin-bottom-right">
              <div className="bg-slate-900/90 border border-cyan-500/50 p-4 rounded text-white shadow-xl backdrop-blur-md min-w-[200px]">
                <div className="skew-x-[6deg]">
                  <div className="text-cyan-400 font-black italic text-sm mb-2 border-b border-cyan-500/30 pb-1">FLIGHT CONTROLS</div>

                  {/* WASD Layout */}
                  <div className="flex gap-2 justify-center mb-2 opacity-80">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-6 h-6 border border-white/50 rounded flex items-center justify-center text-xs font-bold">W</div>
                      <div className="flex gap-1">
                        <div className="w-6 h-6 border border-white/50 rounded flex items-center justify-center text-xs font-bold">A</div>
                        <div className="w-6 h-6 border border-slate-600 rounded flex items-center justify-center text-xs font-bold text-slate-500">S</div>
                        <div className="w-6 h-6 border border-white/50 rounded flex items-center justify-center text-xs font-bold">D</div>
                      </div>
                    </div>
                  </div>

                  <ul className="text-[10px] font-mono space-y-1 text-slate-300">
                    <li><span className="text-yellow-400">W</span> - THRUST (推進)</li>
                    <li><span className="text-yellow-400">A/D</span> - ROTATE (旋轉)</li>
                    <li><span className="text-yellow-400">SPACE</span> - FIRE (開火)</li>
                  </ul>
                  <div className="mt-2 text-[9px] text-slate-500 text-center">LONG PRESS FOR DETAILS</div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        showLeaderboard && (
          <div className="absolute inset-0 z-[100] pointer-events-auto">
            <Leaderboard
              entries={leaderboard}
              onClose={() => setShowLeaderboard(false)}
              onChallengeSeed={(entry) => { handleStart(entry); setShowLeaderboard(false); }}
              currentSeed={currentSeed}
              isAdmin={isAdmin}
              token={user?.token}
              onEntryDeleted={() => {
                fetch('/api/leaderboard')
                  .then(res => res.json())
                  .then(setLeaderboard);
              }}
            />
          </div>
        )
      }

      {/* USER MANAGEMENT MODAL */}
      {
        showUserMgmt && isAdmin && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full h-full max-w-4xl max-h-[90vh]">
              <UserManagement
                token={user?.token || ''}
                onClose={() => setShowUserMgmt(false)}
                onUserDeleted={() => {
                  fetch('/api/leaderboard')
                    .then(res => res.json())
                    .then(setLeaderboard);
                }}
                onRedeemCode={handleRedeemCode}
              />
            </div>
          </div>
        )
      }

      {/* LOGIN MODAL */}
      {
        showLogin && !user && (
          <LoginModal
            onLogin={(u) => {
              setUser(u);
              setMoney(u.saveData.money);
              setDiamonds(u.saveData.diamonds || 0);
              if (u.saveData.upgrades) setUpgrades(u.saveData.upgrades);
              if (u.saveData.ownedItems) setOwnedItems(u.saveData.ownedItems);
              if (u.saveData.equippedItem) setEquippedItem(u.saveData.equippedItem);
              setShowLogin(false);
              setPlayerName(u.username); // 使用登录名作为玩家名
              setIsAdmin(u.role === 'admin');
              setNameError(null);
              localStorage.setItem('neuro_drone_token', u.token);
              localStorage.setItem('neuro_drone_name', u.username);
            }}
            onGuest={() => {
              setIsGuest(true);
              setShowLogin(false);
            }}
          />
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
          <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center bg-slate-950 text-white pointer-events-auto overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950 opacity-80 pointer-events-none" />

            <div
              onClick={() => setShowSettings(true)}
              className="group relative flex flex-col items-center cursor-pointer mb-8 transition-all hover:scale-105 active:scale-95 z-10"
              title="Click to change Avatar / Settings (點擊更換頭像/設定)"
            >
              <div className="transform scale-150 border-4 border-cyan-500/30 group-hover:border-cyan-400 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <NeuroFace status="idle" persona={persona} />
              </div>
              <div className="absolute -bottom-12 opacity-0 group-hover:opacity-100 transition-all bg-slate-900/90 text-cyan-400 text-[10px] px-3 py-1 skew-x-[-12deg] border border-cyan-500 font-bold tracking-widest whitespace-nowrap z-10 pointer-events-none translate-y-2 group-hover:translate-y-0">
                <span className="skew-x-[12deg] inline-block">CONFIG PROFILE // 設定</span>
              </div>
            </div>

            {isMultiplayerHost ? (
              <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4 z-10">
                <h2 className="text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] tracking-tighter mb-4">
                  LOBBY <span className="text-2xl font-normal text-slate-500 not-italic tracking-widest ml-2">HOST</span>
                </h2>

                <div className="w-full bg-slate-900/60 backdrop-blur-md border border-slate-700/50 p-6 skew-x-[-6deg] hover:border-green-500/30 transition-colors shadow-2xl">
                  <div className="skew-x-[6deg]">
                    <h3 className="text-emerald-400 font-black italic text-xl border-b border-slate-700/50 pb-2 mb-4 flex justify-between items-end">
                      <span>SQUADRON STATUS // 中隊狀態</span>
                      <span className="text-sm font-mono text-slate-500">{roomParticipants.length} OPERATIVE(S)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar">
                      {roomParticipants.length > 0 ? (
                        roomParticipants.map((p) => (
                          <div key={p.id} className="group relative flex items-center justify-between bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50 p-3 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-1 h-8 ${playerReadyStates.get(p.id) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-yellow-600'}`} />
                              <div className="flex flex-col">
                                <span className={`font-bold font-mono tracking-wider ${p.id === multiplayerId ? 'text-cyan-300' : 'text-slate-200'}`}>
                                  {p.name}
                                  {p.id === multiplayerId && <span className="ml-2 text-[8px] bg-cyan-900 text-cyan-400 px-1 rounded">ME</span>}
                                </span>
                                <span className="text-[9px] text-slate-600 font-mono">ID: {p.id.slice(-4)}</span>
                              </div>
                            </div>
                            <div className="font-mono text-xs font-bold">
                              {playerReadyStates.get(p.id) ? (
                                <span className="text-emerald-400 animate-pulse">READY</span>
                              ) : (
                                <span className="text-yellow-600">WAITING</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 text-center text-slate-600 font-mono py-8 animate-pulse">
                          WAITING FOR CONNECTION SYNC...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 skew-x-[-12deg] border border-slate-600 hover:border-slate-400 transition-all active:scale-95"
                  >
                    <div className="skew-x-[12deg] flex items-center justify-center gap-2">
                      <span>⚙️</span> SETTINGS
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (mpManagerRef.current) {
                        // [FIX] Re-broadcast seed right before GAME_START to ensure all clients have it
                        mpManagerRef.current.broadcast({ type: 'SYNC_SEED', seed: currentSeed });
                        mpManagerRef.current.broadcast({ type: 'GAME_START' });
                        handleMultiplayerEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'GAME_START' } });
                      }
                    }}
                    disabled={!roomParticipants.every(p => playerReadyStates.get(p.id))}
                    className={`flex-[2] py-4 font-black italic text-xl skew-x-[-12deg] transition-all active:scale-95 relative overflow-hidden group ${roomParticipants.every(p => playerReadyStates.get(p.id))
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                      }`}
                  >
                    <div className="skew-x-[12deg] relative z-10 flex flex-col items-center leading-none">
                      <span>{roomParticipants.every(p => playerReadyStates.get(p.id)) ? 'INITIATE LAUNCH' : 'AWAITING READINESS'}</span>
                      <span className="text-[10px] font-normal font-mono opacity-80 tracking-widest mt-1">
                        {roomParticipants.every(p => playerReadyStates.get(p.id)) ? '所有系統已就緒 // 可開始' : `${roomParticipants.filter(p => playerReadyStates.get(p.id)).length} / ${roomParticipants.length} OPERATORS READY`}
                      </span>
                    </div>
                    {roomParticipants.every(p => playerReadyStates.get(p.id)) && (
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-[12deg]" />
                    )}
                  </button>
                </div>

                {mpManagerRef.current && mpManagerRef.current.pendingRequests.length > 0 && (
                  <div
                    onClick={() => setShowSettings(true)}
                    className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 font-bold py-2 border border-yellow-500/50 flex items-center justify-center gap-2 cursor-pointer animate-bounce-slow"
                  >
                    <span>⚠️</span> {mpManagerRef.current.pendingRequests.length} PENDING AUTHORIZATION REQUEST(S) // 待處理請求
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center w-full max-w-lg z-10">
                <div className="bg-slate-900/80 backdrop-blur border-2 border-slate-700 p-8 skew-x-[-6deg] text-center shadow-2xl relative overflow-hidden w-full mb-4">
                  <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/50 animate-pulse"></div>
                  <div className="skew-x-[6deg]">
                    <h2 className="text-3xl font-black italic text-cyan-400 mb-2">STANDBY MODE</h2>
                    <p className="text-slate-400 font-mono text-sm tracking-wider mb-6">AWAITING HOST COMMAND // 等待房主開始</p>
                    <div className="flex justify-center gap-2">
                      <span className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-0"></span>
                      <span className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-100"></span>
                      <span className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-200"></span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/60 backdrop-blur border border-slate-700 rounded-lg p-4 w-full text-center">
                  <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">CURRENT ZONE SEED</p>
                  <p className="text-2xl font-mono font-bold text-white tracking-widest">{currentSeed}</p>
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg border-2 border-slate-600 shadow-lg tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  ⚙️ 系統設定
                </button>
              </div>
            )}
          </div>
        )
      }


      {
        pendingScore && showSaveModal && (
          <div className="absolute inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-auto p-4 animate-fade-in">
            <div className="bg-slate-900 border border-cyan-500/50 p-1 w-full max-w-md skew-x-[-6deg] shadow-[0_0_50px_rgba(6,182,212,0.3)] relative group">
              <div className="absolute inset-0 border-2 border-cyan-400 opacity-50 blur-[2px]" />
              <div className="absolute -top-4 -left-4 w-8 h-8 border-t-4 border-l-4 border-cyan-400" />
              <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-4 border-r-4 border-cyan-400" />

              <div className="bg-slate-900/90 p-8 skew-x-[6deg]">
                <h2 className="text-4xl font-black italic text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)] mb-6 tracking-tighter transform -rotate-2">
                  NEW RECORD <span className="block text-lg font-normal text-slate-400 not-italic tracking-widest mt-1">DISTANCE LOGGED // 新紀錄</span>
                </h2>

                <div className="relative mb-8 group/input">
                  <input
                    autoFocus={!pendingScore.name}
                    type="text"
                    value={playerName}
                    onChange={(e) => !pendingScore.name && setPlayerName(e.target.value.slice(0, 12))}
                    placeholder="ENTER CALLSIGN..."
                    disabled={!!pendingScore.name}
                    className={`w-full bg-slate-950/50 border-b-2 border-slate-700 text-cyan-300 font-mono text-xl p-4 outline-none transition-all focus:border-cyan-400 text-center placeholder:text-slate-700 uppercase tracking-[0.2em] ${!!pendingScore.name ? 'opacity-60 cursor-not-allowed border-green-500/50 text-green-400' : 'focus:bg-cyan-950/20'}`}
                  />
                  {!!pendingScore.name && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">🔒 LOCKED</span>}
                  <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-cyan-500 transition-all duration-300 group-focus-within/input:w-full" />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => saveToLeaderboard(pendingScore.name || playerName || 'Anonymous', pendingScore.distance, pendingScore.time, pendingScore.trajectory, pendingScore.cargoTrajectory)}
                    className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white font-black italic text-xl py-4 skew-x-[-12deg] shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95 group/btn relative overflow-hidden"
                  >
                    <div className="skew-x-[12deg] relative z-10 flex items-center justify-center gap-2">
                      <span>SAVE RECORD</span>
                      <span className="text-xs font-mono bg-black/30 px-2 py-0.5 rounded">⏎</span>
                    </div>
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-[12deg]" />
                  </button>

                  <button
                    onClick={() => {
                      setPendingScore(null);
                      setShowSaveModal(false);
                      if (postScoreAction === 'RESTART') handleStart();
                      else if (postScoreAction === 'MENU') {
                        setShowSettings(false);
                        setGameState(GameState.MENU);
                      }
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold py-4 skew-x-[-12deg] border border-slate-600 transition-all active:scale-95"
                  >
                    <div className="skew-x-[12deg]">DISCARD</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Joining Requests Notification Overlay */}
      {
        pendingRequests.length > 0 && isMultiplayerHost && (
          <div className="absolute top-24 right-6 z-[500] space-y-4 pointer-events-auto w-80">
            {pendingRequests.map(req => (
              <div key={req.id} className="group relative">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 to-amber-600 animate-pulse" />
                <div className="bg-slate-900/90 border border-yellow-500/50 p-4 skew-x-[-6deg] shadow-[0_0_20px_rgba(234,179,8,0.2)] hover:shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all backdrop-blur-md">
                  <div className="skew-x-[6deg]">
                    <div className="flex justify-between items-start mb-3 border-b border-yellow-500/30 pb-2">
                      <div className="font-black italic text-yellow-400 text-sm tracking-widest uppercase flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                        INCOMING LINK // 連線請求
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">ID: {req.id.slice(-4)}</div>
                    </div>

                    <div className="text-white text-xl font-black italic mb-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 border border-slate-600 flex items-center justify-center text-lg">👤</div>
                      <div className="flex flex-col">
                        <span className="leading-none">{req.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal tracking-wide">OPERATOR CLASS</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (mpManagerRef.current) mpManagerRef.current.approveJoin(req.id, currentSeed);
                          setPendingRequests(prev => prev.filter(p => p.id !== req.id));
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 skew-x-[-6deg] text-xs transition-all active:scale-95 border border-emerald-400/50"
                      >
                        <div className="skew-x-[6deg]">APPROVE // 允許</div>
                      </button>
                      <button
                        onClick={() => {
                          if (mpManagerRef.current) mpManagerRef.current.rejectJoin(req.id);
                          setPendingRequests(prev => prev.filter(p => p.id !== req.id));
                        }}
                        className="flex-1 bg-red-900/60 hover:bg-red-600 text-white font-bold py-2 skew-x-[-6deg] text-xs transition-all active:scale-95 border border-red-500/50"
                      >
                        <div className="skew-x-[6deg]">DENY // 拒絕</div>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setSettingsTab('room');
                        setShowSettings(true);
                      }}
                      className="w-full text-center text-slate-500 text-[10px] mt-3 hover:text-yellow-400 transition-colors font-mono tracking-wider"
                    >
                      OPEN ROOM MANAGER [ ► ]
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {
        gameState === GameState.CHECKPOINT_SHOP && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-slate-950/90 backdrop-blur-md pointer-events-auto overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(34,197,94,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950 opacity-80 pointer-events-none" />

            <div className="bg-slate-900/80 border-4 border-green-500 p-8 skew-x-[-6deg] text-center shadow-[0_0_50px_rgba(34,197,94,0.3)] relative z-10 max-w-4xl w-full mx-4">
              <div className="skew-x-[6deg]">
                <h2 className="text-6xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)] tracking-tighter mb-8 transform -rotate-1">
                  SUPPLY DEPOT <span className="text-2xl font-normal text-slate-500 not-italic tracking-widest ml-2">CHECKPOINT // 補給站</span>
                </h2>

                <div className="flex flex-wrap justify-center gap-6 mb-10">
                  {/* Refuel Button */}
                  <div className="group relative">
                    <button onClick={handleBuyRefuel} className="w-48 h-32 bg-blue-900/40 hover:bg-blue-800/60 border-2 border-blue-500/50 hover:border-blue-400 text-blue-300 transition-all active:scale-95 skew-x-[-12deg] flex flex-col items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                      <div className="skew-x-[12deg] flex flex-col items-center">
                        <span className="text-3xl">⛽</span>
                        <span className="font-black italic text-xl tracking-wider">REFUEL // 燃料</span>
                        <span className="text-xs font-mono text-blue-400 bg-black/50 px-2 py-1 mt-1 rounded border border-blue-500/30">$10</span>
                      </div>
                    </button>
                    <div className="absolute top-full mt-2 w-full text-center text-[10px] text-blue-400/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      EMERGENCY REFUEL<br />燃料補充
                    </div>
                  </div>

                  {/* Repair Button */}
                  <div className="group relative">
                    <button onClick={handleBuyRepair} className="w-48 h-32 bg-red-900/40 hover:bg-red-800/60 border-2 border-red-500/50 hover:border-red-400 text-red-300 transition-all active:scale-95 skew-x-[-12deg] flex flex-col items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                      <div className="skew-x-[12deg] flex flex-col items-center">
                        <span className="text-3xl">🔧</span>
                        <span className="font-black italic text-xl tracking-wider">REPAIR // 維修</span>
                        <span className="text-xs font-mono text-red-400 bg-black/50 px-2 py-1 mt-1 rounded border border-red-500/30">$20</span>
                      </div>
                    </button>
                    <div className="absolute top-full mt-2 w-full text-center text-[10px] text-red-400/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      HULL RESTORATION<br />機身修復
                    </div>
                  </div>

                  {/* Workshop Button */}
                  <div className="group relative">
                    <button onClick={() => setGameState(GameState.SHOP)} className="w-48 h-32 bg-purple-900/40 hover:bg-purple-800/60 border-2 border-purple-500/50 hover:border-purple-400 text-purple-300 transition-all active:scale-95 skew-x-[-12deg] flex flex-col items-center justify-center gap-2 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                      <div className="skew-x-[12deg] flex flex-col items-center">
                        <span className="text-3xl">💎</span>
                        <span className="font-black italic text-xl tracking-wider">WORKSHOP // 工坊</span>
                        <span className="text-xs font-mono text-purple-400 bg-black/50 px-2 py-1 mt-1 rounded border border-purple-500/30">UPGRADE</span>
                      </div>
                    </button>
                    <div className="absolute top-full mt-2 w-full text-center text-[10px] text-purple-400/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      VEDAL'S LAB<br />裝備升級
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLaunchFromShop}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black italic text-3xl py-6 skew-x-[-12deg] shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:shadow-[0_0_50px_rgba(16,185,129,0.6)] transition-all active:scale-[0.98] group relative overflow-hidden"
                >
                  <div className="skew-x-[12deg] flex items-center justify-center gap-4 relative z-10">
                    <span>LAUNCH OPERATION // 出發</span>
                    <span className="text-emerald-900 bg-emerald-400 rounded-full w-8 h-8 flex items-center justify-center text-sm">▶</span>
                  </div>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out skew-x-[12deg]" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        gameState === GameState.GAME_OVER && !isSpectating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-50 overflow-hidden font-sans select-none">
            {/* Global Background Tech Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #7f1d1d 0%, #020617 70%)' }}></div>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(220,38,38,0.05)_50%,rgba(0,0,0,0)_50%)] bg-[length:100%_4px] opacity-30 z-0" />

            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4 animate-fade-in-up">

              <div className="mb-8 transform scale-125 cursor-pointer hover:brightness-125 active:scale-110 transition-all group relative" onClick={() => setShowSettings(true)}>
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
                <NeuroFace status="dead" persona={persona} />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 text-red-400 text-[10px] px-3 py-1 skew-x-[-12deg] border border-red-500/30 font-bold opacity-0 group-hover:opacity-100 transition-opacity tracking-widest whitespace-nowrap">
                  SYSTEM CONFIG // 設定
                </div>
              </div>

              <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse mb-2 glitch-text" data-text="MISSION FAILED">
                MISSION FAILED
              </h1>
              <h2 className="text-xl md:text-2xl font-bold tracking-[0.8em] text-red-200/60 mb-8 uppercase">
                {deathDetails.reasonDisplay}
              </h2>

              {/* Stats Panel */}
              <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl justify-center mb-10">
                <div className="flex-1 bg-slate-900/40 backdrop-blur-md border border-red-500/30 p-6 skew-x-[-6deg] hover:bg-slate-900/60 transition-colors">
                  <div className="skew-x-[6deg] text-center">
                    <div className="text-xs text-red-400 font-mono tracking-widest mb-1">TOTAL DISTANCE</div>
                    <div className="text-4xl font-black italic text-white flex justify-center items-baseline gap-2">
                      {finalDistance} <span className="text-lg text-slate-500 font-normal">m</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-slate-900/40 backdrop-blur-md border border-red-500/30 p-6 skew-x-[-6deg] hover:bg-slate-900/60 transition-colors">
                  <div className="skew-x-[6deg] text-center">
                    <div className="text-xs text-red-400 font-mono tracking-widest mb-1">GLOBAL RANK</div>
                    <div className="text-4xl font-black italic text-white">
                      #{leaderboard.filter(e => e.distance > finalDistance).length + 1}
                    </div>
                  </div>
                </div>
              </div>

              {/* Taunt Message */}
              <div className="w-full max-w-2xl bg-black/40 border-l-4 border-yellow-500 p-4 mb-10">
                <div className="text-yellow-500 font-serif italic text-xl md:text-2xl text-center leading-relaxed opacity-90">
                  "{deathDetails.taunt.split('||')[1] || deathDetails.taunt.split('||')[0]}"
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono mt-2 tracking-widest uppercase">— AI ANALYSIS REPORT</div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-6">
                {!multiplayerMode ? (
                  <>
                    <button
                      onClick={handleRespawn}
                      className="group relative px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-black italic skew-x-[-12deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.4)] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[12deg]" />
                      <span className="skew-x-[12deg] inline-block text-xl tracking-wider">RESPAWN // 重生</span>
                    </button>

                    <button
                      onClick={handleRestartFull}
                      className="group px-8 py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-black italic skew-x-[-12deg] transition-all hover:scale-105 active:scale-95 border border-slate-500/50"
                    >
                      <span className="skew-x-[12deg] inline-block text-xl tracking-wider">RESTART // 重來</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsSpectating(true)}
                    className="group px-10 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-black italic skew-x-[-12deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(234,179,8,0.4)] animate-pulse"
                  >
                    <span className="skew-x-[12deg] inline-block text-xl tracking-wider">SPECTATE // 觀戰</span>
                  </button>
                )}

                <button
                  onClick={handleBackToMenu}
                  className="px-8 py-4 text-slate-500 hover:text-white font-bold font-mono text-sm tracking-widest underline decoration-slate-700 hover:decoration-white underline-offset-4 transition-colors"
                >
                  RETURN TO BASE
                </button>
              </div>

            </div>
          </div>
        )
      }

      {/* Multiplayer Room Leaderboard - All Players Dead */}
      {
        multiplayerMode && allPlayersDead && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[250] overflow-hidden font-sans select-none">
            {/* Background Effects (same as single player GAME_OVER) */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #7f1d1d 0%, #020617 70%)' }}></div>
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(220,38,38,0.05)_50%,rgba(0,0,0,0)_50%)] bg-[length:100%_4px] opacity-30 z-0" />

            <div className="relative z-10 flex flex-col items-center w-full max-w-4xl px-4 animate-fade-in-up">

              <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse mb-2 glitch-text" data-text="GAME OVER">
                GAME OVER
              </h1>
              <h2 className="text-xl md:text-2xl font-bold tracking-[0.8em] text-red-200/60 mb-8 uppercase">
                ALL OPERATORS DOWN // 全員陣亡
              </h2>

              {/* Room Leaderboard */}
              <div className="w-full max-w-2xl mb-10">
                <div className="bg-slate-900/40 backdrop-blur-md border border-red-500/30 p-6 skew-x-[-3deg]">
                  <div className="skew-x-[3deg]">
                    <div className="text-xs text-cyan-400 font-mono tracking-[0.5em] mb-4 border-b border-slate-700 pb-2 uppercase">Room Ranking // 房間排行</div>
                    <div className="space-y-2">
                      {roomLeaderboard
                        .sort((a, b) => b.distance - a.distance)
                        .map((player, index) => (
                          <div
                            key={player.id}
                            className={`flex items-center justify-between p-3 skew-x-[-6deg] transition-colors ${player.id === (multiplayerId || 'ME')
                              ? 'bg-cyan-900/40 border-l-4 border-cyan-400'
                              : 'bg-slate-800/60 border-l-4 border-transparent hover:bg-slate-800'
                              }`}
                          >
                            <div className="skew-x-[6deg] flex items-center gap-4">
                              <span className={`text-3xl font-black italic ${index === 0 ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' :
                                index === 1 ? 'text-gray-300' :
                                  index === 2 ? 'text-orange-500' : 'text-slate-500'
                                }`}>
                                #{index + 1}
                              </span>
                              <div>
                                <div className="font-black italic text-white tracking-wide">
                                  {player.id === (multiplayerId || 'ME') ? 'YOU // 我' : player.id.slice(-4)}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">{player.persona}</div>
                              </div>
                            </div>
                            <div className="skew-x-[6deg] text-right">
                              <div className="text-2xl font-black italic text-white flex items-baseline gap-1">
                                {player.distance}<span className="text-sm text-slate-500 font-normal">m</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-6">
                {isMultiplayerHost ? (
                  <>
                    <button
                      onClick={() => {
                        const newSeed = Math.random().toString(36).substring(2, 9).toUpperCase();
                        setCurrentSeed(newSeed);
                        setGameKey(k => k + 1);
                        if (mpManagerRef.current) {
                          mpManagerRef.current.broadcast({ type: 'GAME_RESTART' });
                          mpManagerRef.current.broadcast({ type: 'SYNC_SEED', seed: newSeed });
                        }
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setGameState(GameState.WAITING_LOBBY);
                      }}
                      className="group relative px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-black italic skew-x-[-12deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.4)] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[12deg]" />
                      <span className="skew-x-[12deg] inline-block text-xl tracking-wider relative z-10">RESTART // 重新開始</span>
                    </button>

                    <button
                      onClick={() => {
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setMultiplayerMode(false);
                        setGameState(GameState.MENU);
                      }}
                      className="px-8 py-4 text-slate-500 hover:text-white font-bold font-mono text-sm tracking-widest underline decoration-slate-700 hover:decoration-white underline-offset-4 transition-colors"
                    >
                      RETURN TO BASE
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-black/40 border-l-4 border-yellow-500 p-4 skew-x-[-6deg]">
                      <div className="skew-x-[6deg] text-center">
                        <p className="text-yellow-400 font-black italic text-lg animate-pulse tracking-wider">AWAITING HOST...</p>
                        <p className="text-slate-500 text-xs font-mono tracking-widest mt-1">等待房主重新開始</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setAllPlayersDead(false);
                        setRoomLeaderboard([]);
                        setMultiplayerMode(false);
                        setGameState(GameState.MENU);
                      }}
                      className="px-8 py-4 text-slate-500 hover:text-white font-bold font-mono text-sm tracking-widest underline decoration-slate-700 hover:decoration-white underline-offset-4 transition-colors"
                    >
                      RETURN TO BASE
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
            <Shop
              money={money}
              diamonds={diamonds}
              upgrades={upgrades}
              buyUpgrade={handleBuyUpgrade}
              onNextLevel={() => setGameState(GameState.CHECKPOINT_SHOP)}
              ownedItems={ownedItems}
              equippedItem={equippedItem}
              buyItem={handleBuyItem}
              equipItem={handleEquipItem}
              onExchangeDiamond={() => {
                if (money >= 1000) {
                  const newMoney = money - 1000;
                  const newDiamonds = diamonds + 1;
                  setMoney(newMoney);
                  setDiamonds(newDiamonds);
                  saveGame(newMoney, newDiamonds);
                  SoundManager.play('coin');
                  setVedalMessage("成功兌換 1 顆鑽石！💎");
                } else {
                  setVedalMessage("金幣不足 1000，無法兌換鑽石。");
                }
              }}
            />
          </div>
        )
      }

      <div className="absolute inset-0 z-0">
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
          setStats={(hp, fuel, cargoHp, distance, distToNext, speed, equippedItem, trainX, isBursting) => setStats(hp, fuel, cargoHp, distance, distToNext, speed, equippedItem, trainX, isBursting)}
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
          multiplayer={useMemo(() => ({
            isActive: multiplayerMode,
            manager: mpManagerRef.current,
            remotePlayers
          }), [multiplayerMode, remotePlayers, managerReady])}
          isSpectating={isSpectating}
          spectatorTargetId={spectatorTargetId}
          setSpectatorTargetId={setSpectatorTargetId}
          mpUpdateRate={mpUpdateRate}
        />
      </div>

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
        onUpdateName={handleUpdateName}
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
        onToggleMobileMode={handleToggleMobileMode}
        onForceRestart={handleForceRestart}
        initialTab={settingsTab}
        isAdmin={isAdmin}
        isLoggedIn={!!user}
        nameError={nameError}
        vedalMessage={vedalMessage}
        onLogout={handleLogout}
        onRedeemCode={handleRedeemCode}
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
            {(() => {
              const currentStats = (isSpectating && spectatorTargetId && remotePlayers.get(spectatorTargetId)) ? {
                hp: remotePlayers.get(spectatorTargetId)!.hpPercent ?? 100,
                fuel: remotePlayers.get(spectatorTargetId)!.fuel ?? 100,
                cargoHp: remotePlayers.get(spectatorTargetId)!.cargoHealth ?? 100,
                distance: remotePlayers.get(spectatorTargetId)!.scoreDistance ?? 0,
                distToNext: remotePlayers.get(spectatorTargetId)!.distToNext ?? 0,
                speed: 0,
                equippedItem: 'NONE' as EquipmentId
              } : displayStats;

              return (
                <HUDOverlay
                  {...currentStats}
                  maxHp={100}
                  maxFuel={100}
                  maxCargoHp={100}
                  money={money}
                  gameTime={gameTime}
                  faceStatus={faceStatus}
                  persona={persona}
                  vedalMessage={vedalMessage}
                  isMobile={isMobileMode}
                  urgentOrderProgress={urgentOrderProgress}
                  onAvatarClick={() => setShowSettings(true)}
                  isFullscreen={isFullscreen}
                  isAdmin={isAdmin}
                  userName={playerName}
                  nameError={nameError}
                  isBursting={currentStats.isBursting}
                />
              );
            })()}
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



      {/* Character Select Overlay */}
      {
        gameState === GameState.MENU && showCharacterSelect && (
          <CharacterSelectOverlay
            onSelect={(p) => {
              setPersona(p);
              setShowCharacterSelect(false);
              handleStart();
            }}
            onClose={() => setShowCharacterSelect(false)}
            isMobile={isMobileMode}
          />
        )
      }

      {/* Tutorial Overlay */}
      {
        showTutorial && (
          <TutorialOverlay
            onComplete={() => {
              setShowTutorial(false);
            }}
            onSkip={() => setShowTutorial(false)}
          />
        )
      }

      {/* Tutorial Button (Menu Only) */}
      {
        gameState === GameState.MENU && !showSettings && !showUserMgmt && !showRoomBrowser && (
          <button
            className="absolute bottom-4 right-4 z-[100] w-12 h-12 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-2xl border-4 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)] flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
            onClick={() => setShowTutorial(true)}
            title="Tutorial / Tour (教學)"
          >
            ?
            <span className="absolute right-full mr-2 bg-slate-800 text-cyan-400 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-cyan-500 pointer-events-none">
              New to game? Start here!
            </span>
          </button>
        )
      }

      {/* Version Number */}
      <div className="absolute bottom-2 left-2 text-[8px] text-white/20 font-mono pointer-events-none uppercase tracking-tighter">
        Alpha
      </div>
    </div >
  );
};

export default App;
