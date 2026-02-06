
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { DroneView } from './DroneView';
import { Drone, Cargo, LevelData, Vector2, Persona, UpgradeStats, GameState, InputState, Rect, Coin, Tutel, GasZone, PowerUp, Train, EquipmentId, UrgentOrder, ControlsConfig } from '../types';
import * as MathUtils from '../utils/math';
import * as Constants from '../constants';
import { SoundManager } from '../utils/audio';
import { MultiplayerManager, RemotePlayer } from '../utils/multiplayer';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
    text?: string; // For persona specific effects (Neuro's code)
}

interface DamageText {
    x: number;
    y: number;
    text: string;
    life: number;
}

interface Debris {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    va: number; // angular velocity
    size: number;
    color: string;
    life: number;
}



interface GameCanvasProps {
    gameState: GameState;
    setGameState: (s: GameState) => void;
    persona: Persona;
    setPersona: (p: Persona) => void;
    difficulty: 'NORMAL' | 'EASY';
    isMobileMode: boolean;
    upgrades: UpgradeStats;
    equippedItem: EquipmentId;
    addMoney: (amount: number) => void;
    setFaceStatus: (s: 'idle' | 'panic' | 'dead' | 'win' | 'fast') => void;
    setVedalMessage: (msg: string) => void;
    setStats: (hp: number, fuel: number, cargoHp: number, distance: number, distToNext: number, speed: number, equippedItem: EquipmentId, trainX?: number) => void;
    lastCheckpoint: Vector2;
    setLastCheckpoint: (pos: Vector2) => void;
    respawnToken?: number;
    onGrantRandomUpgrade: (name: string) => string;
    setUrgentOrderProgress: (progress: { percent: number, timeLeft: number } | null) => void;
    onUpdateTrajectory?: (trajectory: { x: number, y: number }[], cargoTrajectory: { x: number, y: number }[]) => void;
    seed: string;
    isLayoutEditing?: boolean;
    ghostData?: { trajectory: { x: number, y: number }[], cargoTrajectory?: { x: number, y: number }[], name: string } | null;
    controls: ControlsConfig;
    onCrash: (reason: string, finalDistance: number, trajectory: { x: number, y: number }[], cargoTrajectory: { x: number, y: number }[], trainX?: number) => void;
    multiplayer?: {
        isActive: boolean;
        manager: MultiplayerManager | null;
        remotePlayers: Map<string, RemotePlayer>;
    };
    isSpectating?: boolean;
    spectatorTargetId?: string | null;
    setSpectatorTargetId?: (id: string | null) => void;
    mpUpdateRate?: 'low' | 'med' | 'high';
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
    gameState,
    setGameState,
    persona,
    setPersona,
    difficulty,
    isMobileMode,
    upgrades,
    equippedItem,
    addMoney,
    onCrash,
    setFaceStatus,
    setVedalMessage,
    setStats,
    lastCheckpoint,
    setLastCheckpoint,
    respawnToken = 0,
    onGrantRandomUpgrade,
    setUrgentOrderProgress,
    onUpdateTrajectory,
    seed,
    isLayoutEditing = false,
    ghostData,
    controls,
    multiplayer,
    isSpectating,
    spectatorTargetId,
    setSpectatorTargetId,
    mpUpdateRate = 'med'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const rngRef = useRef(MathUtils.createRng(MathUtils.stringToSeed(seed)));

    // Ghost Logic
    const trajectoryRef = useRef<{ x: number, y: number }[]>([]);
    const cargoTrajectoryRef = useRef<{ x: number, y: number }[]>([]);
    const trajectoryTimerRef = useRef(0);
    const frameCounterRef = useRef(0);
    const trajectoryCheckpointLengthRef = useRef(0);
    const cargoTrajectoryCheckpointLengthRef = useRef(0);

    // High Speed & Trail Effects
    const highSpeedTimerRef = useRef(0);
    const isHighSpeedRef = useRef(false);
    const trailRef = useRef<{ x: number, y: number, angle: number }[]>([]);
    const trailTimerRef = useRef(0);
    const sonicBoomsRef = useRef<{ x: number, y: number, radius: number, life: number }[]>([]);
    const lastBoostDistRef = useRef(0);
    const sonicBoostTimerRef = useRef(0);
    const parallaxStreaksRef = useRef<{ x: number, y: number, length: number, speed: number, alpha: number }[]>([]);
    const rotorGlowTrailRef = useRef<{ left: { x: number, y: number, life: number }[], right: { x: number, y: number, life: number }[] }>({ left: [], right: [] });
    const currentZoomRef = useRef(1.0);

    // Game Entities Refs
    const droneRef = useRef<Drone>({
        pos: { ...lastCheckpoint },
        vel: { x: 0, y: 0 },
        angle: 0,
        angularVel: 0,
        radius: 15,
        fuel: 100,
        maxFuel: 100,
        health: 100,
        maxHealth: 100,
        thrustPower: 0,
        invincibleTimer: 0,
        isGodMode: false
    });

    const cargoRef = useRef<Cargo>({
        pos: { x: lastCheckpoint.x, y: lastCheckpoint.y + 60 },
        vel: { x: 0, y: 0 },
        angle: 0,
        angularVel: 0,
        radius: 12,
        health: 100,
        maxHealth: 100,
        connected: true
    });

    const levelRef = useRef<LevelData>({
        walls: [],
        obstacles: [],
        coins: [],
        powerups: [],
        tutels: [],
        gasZones: [],
        urgentOrders: [],
        train: { x: -500, y: 500, speed: 2, w: 120, h: 40 }
    });

    // Urgent Order Timer Ref
    const activeOrderRef = useRef<{ active: boolean, timeLeft: number, maxTime: number }>({ active: false, timeLeft: 0, maxTime: 0 });

    // Infinite Generation State
    const nextGenX = useRef<number>(0);
    const nextCheckpointX = useRef<number>(Constants.CHECKPOINT_INTERVAL);
    const maxDistanceRef = useRef<number>(0);
    const lastBiomeRef = useRef<number>(-1); // Track last biome to prevent repetition
    // [MAP SYNC] Track the X coordinate where the current map generation sequence started
    // This is critical for spectators to replicate the exact RNG sequence relative to coordinates.
    const mapGenerationStartX = useRef<number>(0);

    // Track the exact X coordinate of the wall where we last delivered to prevent spamming
    const lastDeliveryWallX = useRef<number>(-9999);



    const inputQueueRef = useRef<InputState[]>([]);
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const mousePosRef = useRef<Vector2>({ x: 0, y: 0 }); // Screen position
    const joystickRef = useRef<{ x: number, y: number, active: boolean }>({ x: 0, y: 0, active: false });

    const hasLaunchedRef = useRef(false);
    const lastDamageSource = useRef<string>('WALL');
    const fuelEmptyFramesRef = useRef(0);

    const cameraRef = useRef<Vector2>({ x: 0, y: 0 });

    // Visual Effects Refs
    const particlesRef = useRef<Particle[]>([]);
    const damageTextsRef = useRef<DamageText[]>([]);
    const shakeRef = useRef<number>(0);
    const hitStopRef = useRef<number>(0);
    const damageFlashRef = useRef<number>(0);

    // Death Debris Refs
    const debrisRef = useRef<Debris[]>([]);
    const deathSequenceRef = useRef<{ step: 'dying' | 'dead'; reason: string; distance: number; trajectory: { x: number, y: number }[]; cargoTrajectory: { x: number, y: number }[]; trainX?: number; startTime: number; pos: { x: number, y: number } } | null>(null);

    const mpSyncTimerRef = useRef(0);
    const mpUpdateRateRef = useRef(mpUpdateRate);
    useEffect(() => { mpUpdateRateRef.current = mpUpdateRate; }, [mpUpdateRate]);
    const multiplayerRef = useRef(multiplayer);
    multiplayerRef.current = multiplayer; // Always track latest
    const trainGraceTimerRef = useRef(0);

    // Expose refs
    useEffect(() => {
        (window as any).gameRefs = {
            drone: droneRef.current,
            cargo: cargoRef.current,
            // [FIX] Expose trajectory as a dynamic getter to ensure we always get the latest array reference
            get currentTrajectory() { return trajectoryRef.current; },
            get currentCargoTrajectory() { return cargoTrajectoryRef.current; }
        };
    }, [gameState]);

    // --- DRONE OVERLAY REFS & STATE ---
    const droneOverlayRef = useRef<HTMLDivElement>(null);
    const remoteDroneOverlaysRef = useRef<Map<string, HTMLDivElement>>(new Map());

    // Visual State for React Render (Optimization: only update when changed)
    const [droneVisualState, setDroneVisualState] = useState({
        isInvincible: false,
        isGodMode: false,
        isBursting: false
    });
    const lastDroneVisualState = useRef(droneVisualState);


    // --- PROCEDURAL GENERATION ---

    const generateChunk = useCallback((startX: number) => {
        const walls = levelRef.current.walls;
        const coins = levelRef.current.coins;
        const tutels = levelRef.current.tutels;
        const gasZones = levelRef.current.gasZones;
        const urgentOrders = levelRef.current.urgentOrders;

        // Difficulty scaler: increases every 5000 units
        const difficultyFactor = Math.min(5, 1 + Math.floor(startX / 5000));

        // Always add floor and ceiling for this chunk
        // Massive walls to prevent flying over/under
        walls.push({ x: startX, y: -3000, w: Constants.CHUNK_SIZE, h: 3000, type: 'wall' }); // Ceiling (Ends at y=0)
        walls.push({ x: startX, y: 900, w: Constants.CHUNK_SIZE, h: 3000, type: 'wall' }); // Floor (Starts at y=900)

        // Checkpoint Logic
        if (startX >= nextCheckpointX.current) {
            const cpX = startX + 200;
            // Randomize Checkpoint Height slightly to keep it interesting
            const cpY = 300 + Math.floor(rngRef.current() * 400);
            walls.push({ x: cpX, y: cpY, w: 400, h: 20, type: 'checkpoint' });

            // Safe zone around checkpoint
            nextCheckpointX.current += Constants.CHECKPOINT_INTERVAL + (rngRef.current() * 500);
            lastBiomeRef.current = -1; // Reset biome tracking after checkpoint to allow any start
            return startX + 800; // Return end of this chunk
        }

        // Special Event: Urgent Order Spawning
        // 20% Chance per chunk to spawn an Urgent Order
        if (rngRef.current() < 0.2) {
            urgentOrders.push({
                x: startX + 600, // Middle of chunk
                y: 200 + rngRef.current() * 400, // Random height to encourage flying
                radius: 20,
                collected: false
            });
        }

        // Select Biome
        // 0: Pistons, 1: ZigZag, 2: Lasers, 3: Islands/Gas
        let biomeType = Math.floor(rngRef.current() * 4);

        // Prevent consecutive identical biomes
        let attempts = 0;
        while (biomeType === lastBiomeRef.current && attempts < 10) {
            biomeType = Math.floor(rngRef.current() * 4);
            attempts++;
        }
        lastBiomeRef.current = biomeType;

        if (biomeType === 0) {
            // PISTONS
            const gap = 160 - (difficultyFactor * 5);
            for (let i = 0; i < 4; i++) {
                const x = startX + 100 + i * 250;
                const phase = i * 2;
                const speed = 0.03 + (difficultyFactor * 0.005);

                // Top Piston
                walls.push({
                    x: x, y: 0, w: 60, h: 400,
                    type: 'moving_wall',
                    moveConfig: { axis: 'y', range: 150, speed, initialPos: 0, offset: 0, phase }
                });
                // Bottom Piston
                walls.push({
                    x: x, y: 550, w: 60, h: 400,
                    type: 'moving_wall',
                    moveConfig: { axis: 'y', range: 150, speed, initialPos: 550, offset: 0, phase: phase + Math.PI }
                });
                for (let j = 0; j < 3; j++) {
                    coins.push({ x: x + 30, y: 400 + j * 50, radius: 10, collected: false, value: 20 });
                }
            }
        }
        else if (biomeType === 1) {
            // ZIG ZAG TUNNEL
            let y = 400;
            let x = startX;
            const tunnelWidth = Math.max(140, 200 - (difficultyFactor * 10));
            const startUp = rngRef.current() > 0.5; // Randomize start direction

            for (let i = 0; i < 4; i++) {
                const up = (i % 2 === 0) ? startUp : !startUp;
                walls.push({ x: x + 100, y: up ? y - 100 : y + 100, w: 40, h: 200, type: 'wall' });
                walls.push({ x: x, y: 0, w: 300, h: up ? y - tunnelWidth / 2 : y - tunnelWidth / 2 - 100, type: 'wall' });
                walls.push({ x: x, y: up ? y + tunnelWidth / 2 + 100 : y + tunnelWidth / 2, w: 300, h: 600, type: 'wall' });

                if (rngRef.current() > 0.5) {
                    tutels.push({
                        pos: { x: x + 150, y: y },
                        vel: { x: 0, y: 0 }, radius: 10, angle: 0, angularVel: 0, state: 'idle'
                    });
                }
                // [NEW] Add coins in ZigZag tunnel
                for (let j = 0; j < 2; j++) {
                    coins.push({ x: x + 50 + j * 100, y: y + (rngRef.current() - 0.5) * 60, radius: 10, collected: false, value: 20 });
                }
                x += 250;
                y = up ? y + 150 : y - 150;
            }
        }
        else if (biomeType === 2) {
            // FILTER / LASERS
            walls.push({ x: startX, y: 150, w: Constants.CHUNK_SIZE, h: 50, type: 'wall' });
            walls.push({ x: startX, y: 700, w: Constants.CHUNK_SIZE, h: 50, type: 'wall' });

            for (let i = 0; i < 3; i++) {
                const x = startX + 200 + i * 300;
                const gapY = 300 + rngRef.current() * 200;
                const opening = 160;

                walls.push({ x: x, y: 200, w: 30, h: gapY - 200, type: 'hazard' });
                walls.push({ x: x, y: gapY + opening, w: 30, h: 700 - (gapY + opening), type: 'hazard' });

                if (difficultyFactor > 2) {
                    walls.push({
                        x: x - 50, y: gapY + opening / 2 - 10, w: 60, h: 20,
                        type: 'moving_wall',
                        moveConfig: { axis: 'x', range: 80, speed: 0.05, initialPos: x - 50, offset: 0, phase: i }
                    });
                }
                // [NEW] Reward risky laser passage with more coins
                coins.push({ x: x + 15, y: gapY + opening / 2, radius: 12, collected: false, value: 50 });
            }
        }
        else {
            // MOVING ISLANDS / GAS
            if (difficultyFactor > 3) {
                gasZones.push({ x: startX, y: 200, w: Constants.CHUNK_SIZE, h: 500, timer: 0, gravityScale: 1 });
            }
            for (let i = 0; i < 4; i++) {
                const x = startX + 100 + i * 250;
                const y = 300 + rngRef.current() * 300;
                walls.push({
                    x: x, y: y, w: 120, h: 30,
                    type: 'moving_wall',
                    moveConfig: { axis: 'x', range: 100, speed: 0.02, initialPos: x, offset: 0, phase: i * 1.5 }
                });
                // [NEW] Double coins on islands
                coins.push({ x: x + 30, y: y - 30, radius: 10, collected: false, value: 30 });
                coins.push({ x: x + 90, y: y - 30, radius: 10, collected: false, value: 30 });
            }
        }

        return startX + Constants.CHUNK_SIZE;
    }, []);

    const resetDroneState = useCallback(() => {
        const wasGodMode = droneRef.current.isGodMode;

        // Stop wind on reset
        SoundManager.stopWind();
        isHighSpeedRef.current = false;
        highSpeedTimerRef.current = 0;
        trailRef.current = [];

        // [MULTIPLAYER] Offset spawn position to prevent players overlapping
        let spawnOffsetX = 0;
        if (multiplayerRef.current?.isActive && multiplayerRef.current.manager) {
            const myId = multiplayerRef.current.manager.myId || '';
            const allIds = [myId, ...Array.from(multiplayerRef.current.remotePlayers.keys())].sort();
            const myIndex = allIds.indexOf(myId);
            const totalPlayers = allIds.length;
            // Stagger horizontally: each player offset by 80px
            spawnOffsetX = (myIndex - (totalPlayers - 1) / 2) * 80;
        }

        droneRef.current = {
            pos: { x: lastCheckpoint.x + spawnOffsetX, y: lastCheckpoint.y },
            vel: { x: 0, y: 0 },
            angle: 0,
            angularVel: 0,
            radius: 15,
            fuel: 500 + (upgrades.tankLevel * 50),
            maxFuel: 500 + (upgrades.tankLevel * 50),
            health: 100 + (upgrades.hullLevel * 20),
            maxHealth: 100 + (upgrades.hullLevel * 20),
            thrustPower: 0,
            invincibleTimer: 0,
            isGodMode: wasGodMode
        };

        cargoRef.current = {
            // Spawn cargo slightly to the left/behind drone
            pos: { x: lastCheckpoint.x + spawnOffsetX - 25, y: lastCheckpoint.y + 5 },
            vel: { x: 0, y: 0 },
            angle: 0,
            angularVel: 0,
            radius: 12,
            health: 100 + (upgrades.cargoLevel * 20),
            maxHealth: 100 + (upgrades.cargoLevel * 20),
            connected: true
        };

        hasLaunchedRef.current = false;
        lastDamageSource.current = 'WALL';
        fuelEmptyFramesRef.current = 0;

        // Reset order on death/reset
        activeOrderRef.current = { active: false, timeLeft: 0, maxTime: 0 };
        setUrgentOrderProgress(null);

        // [FIX] Rewind trajectory instead of clearing it entirely
        trajectoryRef.current = trajectoryRef.current.slice(0, trajectoryCheckpointLengthRef.current);
        cargoTrajectoryRef.current = cargoTrajectoryRef.current.slice(0, cargoTrajectoryCheckpointLengthRef.current);
        trajectoryTimerRef.current = 0;

        // Reset Death Debris
        debrisRef.current = [];
        deathSequenceRef.current = null;
        // [MULTIPLAYER FIX] Force debris clear again to be safe
        debrisRef.current = [];

        // [MULTIPLAYER FIX] Remove grace period so train kills immediately
        trainGraceTimerRef.current = 0;

    }, [upgrades, lastCheckpoint, setUrgentOrderProgress]);


    const triggerDeathSequence = useCallback((pos: { x: number, y: number }, reason: string, distance: number, trajectory: { x: number, y: number }[], cargoTrajectory: { x: number, y: number }[], trainX?: number) => {
        // Stop wind on death
        SoundManager.stopWind();
        isHighSpeedRef.current = false;
        highSpeedTimerRef.current = 0;

        deathSequenceRef.current = {
            step: 'dying',
            reason,
            distance,
            trajectory: [...trajectory],
            cargoTrajectory: [...cargoTrajectory],
            trainX,
            startTime: performance.now(),
            pos
        };
        // Generate debris
        const isCargoDeath = reason === 'CARGO';
        const debrisCount = isCargoDeath ? 12 : 20 + Math.floor(Math.random() * 8);
        const pieces: Debris[] = [];

        // Cargo color: Amber/Brown, Drone color: Persona-based
        const baseColor = isCargoDeath ? '#d97706' : (persona === Persona.EVIL ? '#ef4444' : '#f472b6');

        if (!isCargoDeath) {
            droneRef.current.health = 0; // Ensure health is 0 to stop other triggers
            // Sever connection on drone death
            cargoRef.current.connected = false;
            // Give cargo initial velocity based on drone's velocity at death
            cargoRef.current.vel.x = droneRef.current.vel.x * 0.8;
            cargoRef.current.vel.y = droneRef.current.vel.y * 0.8;
        } else {
            cargoRef.current.health = 0; // Ensure cargo health is 0
        }

        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * (isCargoDeath ? 5 : 8);
            pieces.push({
                x: pos.x,
                y: pos.y,
                vx: (isCargoDeath ? cargoRef.current.vel.x : droneRef.current.vel.x) * 0.3 + Math.cos(angle) * speed,
                vy: (isCargoDeath ? cargoRef.current.vel.y : droneRef.current.vel.y) * 0.3 + Math.sin(angle) * speed,
                angle: Math.random() * Math.PI * 2,
                va: (Math.random() - 0.5) * 1.2,
                size: isCargoDeath ? 2 + Math.random() * 4 : 3 + Math.random() * 7,
                color: Math.random() > 0.3 ? baseColor : (isCargoDeath ? '#facc15' : '#94a3b8'),
                life: 1.0
            });
        }
        debrisRef.current = pieces;

        // Visual effects
        shakeRef.current = 25;
        hitStopRef.current = 0; // [CRITICAL FIX] Reset hitStop on death to prevent freezing
        damageFlashRef.current = 1.0;
        SoundManager.play('crash');

        // Note: onCrash will be called once debris stops or timeout in the physics loop.
    }, [persona, setFaceStatus]);

    const initWorld = useCallback(() => {
        // Reset Data
        // [MULTIPLAYER FIX] Preserve train if in multiplayer
        let savedTrain = null;
        if (multiplayer?.isActive && levelRef.current?.train) {
            savedTrain = { ...levelRef.current.train };
        }

        // Reset Data
        levelRef.current = {
            walls: [],
            obstacles: [],
            coins: [],
            powerups: [],
            tutels: [],
            gasZones: [],
            urgentOrders: [],
            train: savedTrain || { x: lastCheckpoint.x - 800, y: lastCheckpoint.y, speed: 2.1, w: 120, h: 40 }
        };
        lastBiomeRef.current = -1; // Reset biome tracking
        rngRef.current = MathUtils.createRng(MathUtils.stringToSeed(seed)); // Reset RNG for deterministic world start

        const startWallX = lastCheckpoint.x - 400;

        // Safe Runway - Restored as per user request
        levelRef.current.walls.push({ x: startWallX - 400, y: 900, w: 1200, h: 1000, type: 'wall' }); // Floor
        levelRef.current.walls.push({ x: startWallX - 400, y: -1000, w: 1200, h: 1000, type: 'wall' }); // Ceiling

        // The checkpoint pad
        const cpWallX = lastCheckpoint.x - 200;
        levelRef.current.walls.push({ x: cpWallX, y: lastCheckpoint.y + 20, w: 400, h: 20, type: 'checkpoint' });

        lastDeliveryWallX.current = cpWallX;

        let genX = lastCheckpoint.x + 400;

        // [MAP SYNC] Record the start X.
        mapGenerationStartX.current = genX;

        for (let i = 0; i < 3; i++) {
            genX = generateChunk(genX);
        }
        nextGenX.current = genX;

        nextCheckpointX.current = Math.max(nextCheckpointX.current, lastCheckpoint.x + Constants.CHECKPOINT_INTERVAL);

        trajectoryCheckpointLengthRef.current = 0;
        cargoTrajectoryCheckpointLengthRef.current = 0;
        trajectoryRef.current = [];
        cargoTrajectoryRef.current = [];

        resetDroneState();
        maxDistanceRef.current = lastCheckpoint.x;

    }, [generateChunk, lastCheckpoint, resetDroneState, seed]);




    const respawnLevel = useCallback((forceTrainReset: boolean = false) => {
        resetDroneState();

        // [FIX] Ensure the checkpoint wall exists on respawn (it might have been destroyed by the train)
        const cpWallX = lastCheckpoint.x - 200;
        const hasCheckpointWall = levelRef.current.walls.some(w =>
            w.type === 'checkpoint' && Math.abs(w.x - cpWallX) < 10
        );
        if (!hasCheckpointWall) {
            levelRef.current.walls.push({ x: cpWallX, y: lastCheckpoint.y + 20, w: 400, h: 20, type: 'checkpoint' });
        }

        // [FIX] Ensure Safe Zone Floor/Ceiling exist if they were garbage collected
        // This prevents falling into void if respawning far back
        const startWallX = lastCheckpoint.x - 400;
        const hasFloor = levelRef.current.walls.some(w => Math.abs(w.x - (startWallX - 400)) < 100 && w.y > 500);
        if (!hasFloor) {
            levelRef.current.walls.push({ x: startWallX - 400, y: 900, w: 1200, h: 1000, type: 'wall' }); // Floor
            levelRef.current.walls.push({ x: startWallX - 400, y: -1000, w: 1200, h: 1000, type: 'wall' }); // Ceiling
        }

        // [FIX] Restore missing FUTURE checkpoint (if destroyed by train)
        // If the train ran ahead and destroyed the next checkpoint, we need to put it back
        // otherwise the player has to fly double distance to the next one.
        const nextTargetX = lastCheckpoint.x + Constants.CHECKPOINT_INTERVAL;
        const searchRange = 1000; // Search window around expected location

        // Only checking if we have physically generated past this point
        if (nextGenX.current > nextTargetX) {
            const hasFutureCP = levelRef.current.walls.some(w =>
                w.type === 'checkpoint' && Math.abs(w.x - nextTargetX) < searchRange
            );

            if (!hasFutureCP) {
                // Restore it at a generic height since we lost the RNG config
                levelRef.current.walls.push({
                    x: nextTargetX,
                    y: 500,
                    w: 400,
                    h: 20,
                    type: 'checkpoint'
                });
            }
        }

        // CRITICAL: In multiplayer, NEVER reset train unless explicitly forced (GLOBAL_RESTART)
        // Check multiplayer.isActive directly to ensure stability
        const isMultiplayer = multiplayer?.isActive === true;

        if (!isMultiplayer || forceTrainReset) {
            levelRef.current.train.x = lastCheckpoint.x - 800;
            levelRef.current.train.y = lastCheckpoint.y;
            levelRef.current.train.speed = 2.1;
        }

        // [VISUAL FIX] Clear debris and effects on respawn (since we don't remount in MP)
        debrisRef.current = [];
        particlesRef.current = [];
        damageTextsRef.current = [];
        shakeRef.current = 0;
        hitStopRef.current = 0;
        damageFlashRef.current = 0;

        // [FIX] Clear Powerups (Train Props) on respawn
        // User requested to clean up train items on respawn
        levelRef.current.powerups = [];

        setFaceStatus('idle');
    }, [resetDroneState, lastCheckpoint, setFaceStatus, multiplayer?.isActive]);

    // --- MULTIPLAYER LOGIC (TRAIN SYNC & EVENTS) ---
    useEffect(() => {
        if (!multiplayer?.isActive || !multiplayer.manager) return;

        const handleMpEvent = (event: any) => {
            if (event.type === 'DATA') {
                if (event.data.type === 'SYNC_ENV') {
                    // Sync Train
                    if (event.data.train) {
                        const t = levelRef.current.train;
                        // Client-side strict sync with smoothing
                        const targetX = event.data.train.x;
                        const targetSpeed = event.data.train.speed;

                        // Strict sync: if the difference is huge (e.g. teleport), just snap it
                        if (Math.abs(t.x - targetX) > 500) {
                            t.x = targetX;
                        } else {
                            t.x = t.x + (targetX - t.x) * 0.4;
                        }
                        t.speed = targetSpeed;
                    }

                    // [MAP SYNC] Fast-forward map generation if we are behind host
                    // This ensures our RNG state matches the host's, so coins spawn at correct locations
                    if (event.data.nextGenX && event.data.nextGenX > nextGenX.current) {
                        const targetGenX = event.data.nextGenX;
                        // Limit fast-forward to prevent freeze if delta is huge (e.g. join very late)
                        // But we MUST catch up for RNG to match.
                        // We'll process in chunks.
                        let attempts = 0;
                        while (nextGenX.current < targetGenX && attempts < 500) {
                            nextGenX.current = generateChunk(nextGenX.current);
                            attempts++;
                        }
                    }
                } else if (event.data.type === 'GLOBAL_RESTART') {
                    setVedalMessage("HOST INITIATED RESTART!||房主已重啟遊戲！");
                    setLastCheckpoint({ x: 200, y: 860 }); // Reset checkpoint
                    initWorld(); // Full world reset including all walls
                    resetDroneState();
                    setGameState(GameState.PLAYING);
                    setFaceStatus('idle');
                } else if (event.data.type === 'PICKUP_COLLECT') {
                    const { pickupType, x, y } = event.data;
                    const levelData = levelRef.current;
                    // [SYNC FIX] Increase threshold to handle floating point differences and slight desyncs
                    const threshold = 50;

                    console.log(`[PICKUP] Rcv ${pickupType} at ${Math.floor(x)},${Math.floor(y)}`);

                    if (pickupType === 'COIN') {
                        // 1. Try exact/close match
                        let coin = levelData.coins.find(c => !c.collected && Math.abs(c.x - x) < threshold && Math.abs(c.y - y) < threshold);

                        // 2. Fallback: Find closest coin within reasonable range (100)
                        if (!coin) {
                            const nearby = levelData.coins.filter(c => !c.collected && Math.abs(c.x - x) < 100 && Math.abs(c.y - y) < 100);
                            if (nearby.length > 0) {
                                nearby.sort((a, b) => (Math.pow(a.x - x, 2) + Math.pow(a.y - y, 2)) - (Math.pow(b.x - x, 2) + Math.pow(b.y - y, 2)));
                                coin = nearby[0];
                            }
                        }

                        if (coin) coin.collected = true;
                    } else if (pickupType === 'ORDER') {
                        let order = levelData.urgentOrders.find(o => !o.collected && Math.abs(o.x - x) < threshold && Math.abs(o.y - y) < threshold);

                        if (!order) {
                            const nearby = levelData.urgentOrders.filter(o => !o.collected && Math.abs(o.x - x) < 100 && Math.abs(o.y - y) < 100);
                            if (nearby.length > 0) {
                                nearby.sort((a, b) => (Math.pow(a.x - x, 2) + Math.pow(a.y - y, 2)) - (Math.pow(b.x - x, 2) + Math.pow(b.y - y, 2)));
                                order = nearby[0];
                            }
                        }
                        if (order) order.collected = true;
                    } else if (pickupType === 'POWERUP') {
                        let powerup = levelData.powerups.find(p => !p.collected && Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold);

                        if (!powerup) {
                            const nearby = levelData.powerups.filter(p => !p.collected && Math.abs(p.x - x) < 100 && Math.abs(p.y - y) < 100);
                            if (nearby.length > 0) {
                                nearby.sort((a, b) => (Math.pow(a.x - x, 2) + Math.pow(a.y - y, 2)) - (Math.pow(b.x - x, 2) + Math.pow(b.y - y, 2)));
                                powerup = nearby[0];
                            }
                        }
                        if (powerup) powerup.collected = true;
                    }
                } else if (event.data.type === 'SYNC_MAP_STATE') {
                    // [MAP SYNC]
                    // If we are significantly behind (e.g. spectator join, or late join), we must catch up.
                    // CRITICAL: We must RESET RNG state if we are desynced, otherwise our map will be different even with same seed.
                    const targetGenX = event.data.nextGenX;
                    const hostGenStartX = event.data.mapGenStartX || 0;

                    const delta = targetGenX - nextGenX.current;
                    // Check if our generation start point mismatches the host's
                    // If host started at 3400 and we started at 0, our RNG sequence is misaligned with coordinates.
                    const originMismatch = Math.abs(mapGenerationStartX.current - hostGenStartX) > 10;

                    // If delta is huge (e.g. > 2000), or negative, or ORIGIN MISMATCH.
                    if (delta > 2000 || delta < -500 || originMismatch) {
                        console.log('[MAP_SYNC] DESYNC DETECTED. Hard Resetting & Catching up...', { current: nextGenX.current, target: targetGenX, hostStart: hostGenStartX, localStart: mapGenerationStartX.current });

                        // 1. Reset World Data (Walls, Coins, etc.)
                        const savedTrain = levelRef.current.train ? { ...levelRef.current.train } : undefined;
                        levelRef.current = {
                            walls: [],
                            obstacles: [],
                            coins: [],
                            powerups: [],
                            tutels: [],
                            gasZones: [],
                            urgentOrders: [],
                            train: savedTrain || { x: -800, y: 0, speed: 2.1, w: 120, h: 40 }
                        };
                        lastBiomeRef.current = -1;

                        // 2. Reset RNG
                        rngRef.current = MathUtils.createRng(MathUtils.stringToSeed(seed));

                        // 3. Set Baseline based on Host's Generation Start
                        // Host initWorld logic: 
                        // genX = lastCheckpoint.x + 400  =>  hostGenStartX
                        // nextCheckpointX = lastCheckpoint.x + INTERVAL
                        // So: nextCheckpointX = (hostGenStartX - 400) + INTERVAL
                        mapGenerationStartX.current = hostGenStartX;
                        nextCheckpointX.current = (hostGenStartX - 400) + Constants.CHECKPOINT_INTERVAL;

                        // 4. Manual "initWorld" Platform Generation (Replicating initWorld logic)
                        const startWallX = (hostGenStartX - 400) - 400; // lastCheckpoint.x - 400
                        levelRef.current.walls.push({ x: startWallX - 400, y: 900, w: 1200, h: 1000, type: 'wall' }); // Floor
                        levelRef.current.walls.push({ x: startWallX - 400, y: -1000, w: 1200, h: 1000, type: 'wall' }); // Ceiling
                        // Checkpad
                        const cpWallX = (hostGenStartX - 400) - 200;
                        levelRef.current.walls.push({ x: cpWallX, y: lastCheckpoint.y + 20, w: 400, h: 20, type: 'checkpoint' });

                        // 5. Fast Forward Generation
                        let simGenX = hostGenStartX;

                        // Replicate the initial 3 chunks from initWorld
                        for (let i = 0; i < 3; i++) {
                            simGenX = generateChunk(simGenX);
                        }

                        // Catch up the rest
                        let attempts = 0;
                        while (simGenX < targetGenX && attempts < 2000) {
                            simGenX = generateChunk(simGenX);
                            attempts++;
                        }

                        nextGenX.current = simGenX;
                        console.log('[MAP_SYNC] Catch up complete.', { current: nextGenX.current });
                    }
                }
            }
        };

        // Hook into gameRefs for easy event access from App.tsx
        // Use a unique name to avoid conflict with App.tsx's handler
        // Fix: Use separate check for manager to keep registration stable
        if (multiplayer?.isActive) {
            if (!(window as any).gameRefs) (window as any).gameRefs = {};
            (window as any).gameRefs.handleCanvasMpEvent = handleMpEvent;
        }
        return () => {
            if ((window as any).gameRefs) (window as any).gameRefs.handleCanvasMpEvent = undefined;
        };

    }, [multiplayer?.isActive, multiplayer?.manager]);

    useEffect(() => {
        if (gameState === GameState.PLAYING) {
            // Only init if we are just starting (based on physics state)
            if (!hasLaunchedRef.current && Math.abs(droneRef.current.pos.x - lastCheckpoint.x) < 5 && levelRef.current.walls.length === 0) {
                initWorld();
            }
        }
    }, [gameState, initWorld, lastCheckpoint]);

    // Host Broadcast Loop
    useEffect(() => {
        if (!multiplayer?.isActive || !multiplayer.manager || !multiplayer.isHost) return;
        const interval = setInterval(() => {
            if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) {
                const train = levelRef.current.train;

                // Host calculates the target for the train based on slowest living player
                let minX = droneRef.current.pos.x;
                multiplayer.remotePlayers.forEach(p => {
                    if (p.health > 0) minX = Math.min(minX, p.pos.x);
                });

                // Adjust train speed relative to the slowest player
                const distFromTrain = minX - train.x;
                let targetSpeed = 2.1;
                if (distFromTrain > 1500) targetSpeed = 6.0;
                else if (distFromTrain > 800) targetSpeed = 3.6;
                else targetSpeed = 2.1 + (minX / 10000); // Slower scaling

                train.speed = targetSpeed;
                // Note: Train X movement is still done in the main loop for the host.

                multiplayer.manager?.broadcast({
                    type: 'SYNC_ENV',
                    train: { x: train.x, speed: train.speed },
                    nextGenX: nextGenX.current, // [MAP SYNC] Broadcast map generation progress
                    mapGenStartX: mapGenerationStartX.current // [MAP SYNC] Broadcast origin to align RNG
                });
            }
        }, 200); // [優化] 降低頻率從 100ms 到 200ms (5 次/秒)
        return () => clearInterval(interval);
    }, [multiplayer, gameState]);

    // Handle Initial Start (Fresh Mount)
    useEffect(() => {
        if (gameState === GameState.PLAYING) {
            // Only init if we are just starting (based on physics state)
            if (!hasLaunchedRef.current && Math.abs(droneRef.current.pos.x - lastCheckpoint.x) < 5 && levelRef.current.walls.length === 0) {
                initWorld();
                setFaceStatus('idle');
                setVedalMessage(difficulty === 'EASY'
                    ? "Easy Mode. Mouse/Joy to guide.||簡單模式。滑鼠/搖桿引導。"
                    : "Endless mode. How far can you go?||無限模式。你能飛多遠？"
                );
            }
        }
    }, [gameState, initWorld, lastCheckpoint, setFaceStatus, setVedalMessage, difficulty]);

    // Handle Respawn (Token Trigger)
    useEffect(() => {
        if (respawnToken > 0) {
            respawnLevel();
        }
    }, [respawnToken, respawnLevel]);

    // [FAILSAFE] Force cleanup when GameState becomes PLAYING
    // This handles cases where respawnToken might be missed or desynced
    useEffect(() => {
        if (gameState === GameState.PLAYING) {
            // Clear Death State
            if (deathSequenceRef.current || debrisRef.current.length > 0) {
                debrisRef.current = [];
                deathSequenceRef.current = null;
                setFaceStatus('idle');

                // Ensure drone is alive
                if (droneRef.current.health <= 0) {
                    droneRef.current.health = droneRef.current.maxHealth;
                    droneRef.current.pos = { x: lastCheckpoint.x, y: lastCheckpoint.y };
                    droneRef.current.vel = { x: 0, y: 0 };
                }
            }
        }
    }, [gameState, lastCheckpoint, setFaceStatus]);

    // Input Handling
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;

            keysPressed.current[e.key.toLowerCase()] = true;
            keysPressed.current[e.code] = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current[e.key.toLowerCase()] = false;
            keysPressed.current[e.code] = false;
        };
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }
        };
        const handleJoystickInput = (e: any) => {
            const detail = e.detail;
            joystickRef.current = { x: detail.x, y: detail.y, active: detail.active };
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('joystick-input', handleJoystickInput);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('joystick-input', handleJoystickInput);
        };
    }, [gameState]);

    useEffect(() => {
        if (gameState !== GameState.PLAYING && gameState !== GameState.CHECKPOINT_SHOP && !(multiplayerRef.current?.isActive && gameState === GameState.GAME_OVER)) return;

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;

        let lastTime = performance.now();
        let inputLagTimer = 0;
        let gasMessageShown = false;
        let swarmMessageShown = false;
        let statsThrottleTimer = 0;

        const loop = (time: number) => {
            // [FIX] Always read latest multiplayer state from ref to avoid stale closures
            const multiplayer = multiplayerRef.current;
            if (isLayoutEditing) {
                lastTime = time;
                inputLagTimer = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((time - lastTime) / 16.67, 2);
            lastTime = time;

            const drone = droneRef.current;
            const cargo = cargoRef.current;
            const levelData = levelRef.current;
            const train = levelData.train;

            // Camera Target Logic (Spectator Support)
            let targetPos = drone.pos;
            let effectiveIsSpectating = isSpectating;
            if (gameState === GameState.GAME_OVER && multiplayer?.isActive) {
                effectiveIsSpectating = true;
                if (!spectatorTargetId) {
                    // Auto-pick first available
                    const players = Array.from(multiplayer.remotePlayers.values()).filter((p: any) => p.health > 0);
                    if (players.length > 0) setSpectatorTargetId?.((players[0] as any).id);
                } else {
                    const target = multiplayer.remotePlayers.get(spectatorTargetId);
                    if (target && target.health > 0) {
                        targetPos = target.pos;
                    } else {
                        setSpectatorTargetId?.(null);
                    }
                }
            }

            // Equipment Checks
            const isEcoMode = equippedItem === 'ECO_CHIP';
            const isMagnet = equippedItem === 'MAGNET';
            const isArmored = equippedItem === 'ARMOR';

            // [FIX] Disable generation if needed (e.g. spectator without targetX)
            if (targetPos.x + Constants.RENDER_DISTANCE > nextGenX.current) {
                nextGenX.current = generateChunk(nextGenX.current);
            }

            // Prune entities far behind, but relative to the CAMERA target
            const protectedX = Math.min(targetPos.x, lastCheckpoint.x);
            const pruneX = protectedX - Constants.PRUNE_DISTANCE;

            if (levelData.walls.length > 0 && levelData.walls[0].x < pruneX) {
                levelData.walls = levelData.walls.filter(w => w.x + w.w > pruneX);
                levelData.coins = levelData.coins.filter(c => c.x > pruneX);
                levelData.powerups = levelData.powerups.filter(p => p.x > pruneX);
                levelData.gasZones = levelData.gasZones.filter(g => g.x + g.w > pruneX);
                levelData.urgentOrders = levelData.urgentOrders.filter(o => o.x > pruneX);
                // Don't prune tutels, let them chase forever
            }

            // --- MOVING WALLS UPDATE ---
            levelData.walls.forEach(w => {
                if (w.type === 'moving_wall' && w.moveConfig) {
                    const cfg = w.moveConfig;
                    const t = time * 0.001 * cfg.speed;
                    const offset = Math.sin(t + cfg.phase) * cfg.range;

                    const prevX = w.x;
                    const prevY = w.y;

                    if (cfg.axis === 'x') {
                        w.x = cfg.initialPos + offset;
                    } else {
                        w.y = cfg.initialPos + offset;
                    }
                    w.vel = { x: (w.x - prevX) / dt, y: (w.y - prevY) / dt };
                } else {
                    w.vel = { x: 0, y: 0 };
                }
            });

            // --- PHYSICS UPDATE ---
            // [MULTIPLAYER FIX] Allow physics (especially train) to run in GAME_OVER if multiplayer
            if (gameState === GameState.PLAYING || (deathSequenceRef.current && deathSequenceRef.current.step === 'dying') || (multiplayer?.isActive && gameState === GameState.GAME_OVER)) {
                // Decay Visual FX (Even during hit stop for smoothness)
                if (shakeRef.current > 0) shakeRef.current *= 0.85;
                if (shakeRef.current < 0.1) shakeRef.current = 0;
                if (damageFlashRef.current > 0) damageFlashRef.current -= dt * 0.05;

                // Update Particles
                particlesRef.current = particlesRef.current.filter(p => {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.life -= 0.02 * dt;
                    return p.life > 0;
                });

                // Update Debris & Death Transition
                if (deathSequenceRef.current && deathSequenceRef.current.step === 'dying') {
                    let totalMotion = 0;
                    const ds = deathSequenceRef.current;
                    const isCargoDeath = ds.reason === 'CARGO';
                    debrisRef.current.forEach(deb => {
                        deb.vx *= Math.pow(0.95, dt);
                        deb.vy += Constants.GRAVITY * 0.5 * dt;
                        deb.vy *= Math.pow(0.95, dt);
                        deb.x += deb.vx * dt;
                        deb.y += deb.vy * dt;
                        deb.angle += deb.va * dt;
                        deb.life -= 0.02 * dt;

                        // Optimized Nearby Wall Collisions
                        levelData.walls.forEach(wall => {
                            if (Math.abs(deb.x - wall.x) < 120 && Math.abs(deb.y - wall.y) < 120) {
                                if (deb.x > wall.x && deb.x < wall.x + wall.w && deb.y > wall.y && deb.y < wall.y + wall.h) {
                                    const dxL = deb.x - wall.x;
                                    const dxR = (wall.x + wall.w) - deb.x;
                                    const dyT = deb.y - wall.y;
                                    const dyB = (wall.y + wall.h) - deb.y;
                                    const min = Math.min(dxL, dxR, dyT, dyB);

                                    if (min === dxL) { deb.x = wall.x; deb.vx = -Math.abs(deb.vx) * 0.3; }
                                    else if (min === dxR) { deb.x = wall.x + wall.w; deb.vx = Math.abs(deb.vx) * 0.3; }
                                    else if (min === dyT) { deb.y = wall.y; deb.vy = -Math.abs(deb.vy) * 0.3; }
                                    else { deb.y = wall.y + wall.h; deb.vy = Math.abs(deb.vy) * 0.3; }
                                    deb.va *= 0.8;
                                }
                            }
                        });

                        if (deb.life > 0.2) totalMotion += Math.abs(deb.vx) + Math.abs(deb.vy);
                    });

                    // Update Cargo Physics during drone's death (if it didn't break)
                    if (!isCargoDeath && !cargo.connected) {
                        cargo.vel.y += Constants.GRAVITY * dt;
                        cargo.vel.x *= Math.pow(Constants.DRAG, dt);
                        cargo.vel.y *= Math.pow(Constants.DRAG, dt);
                        cargo.pos.x += cargo.vel.x * dt;
                        cargo.pos.y += cargo.vel.y * dt;

                        // Simple floor/wall collision for cargo
                        levelData.walls.forEach(wall => {
                            if (cargo.pos.x > wall.x && cargo.pos.x < wall.x + wall.w && cargo.pos.y > wall.y && cargo.pos.y < wall.y + wall.h) {
                                cargo.vel.y = -Math.abs(cargo.vel.y) * 0.4;
                                cargo.vel.x *= 0.8;
                            }
                        });
                        totalMotion += Math.abs(cargo.vel.x) + Math.abs(cargo.vel.y);
                    }

                    const stillInPlay = debrisRef.current.filter(d => d.y < 2000 && d.life > 0.1);
                    if (debrisRef.current.length > 0 && stillInPlay.length === 0) totalMotion = 0;

                    // Stop condition: settle MUCH faster (800ms max or motion < 3.0)
                    if (totalMotion < 3.0 || (performance.now() - ds.startTime) > 800) {
                        ds.step = 'dead';
                        onCrash(ds.reason, ds.distance, ds.trajectory, ds.cargoTrajectory, levelRef.current.train.x);
                    }
                }

                // Update Damage Texts
                damageTextsRef.current = damageTextsRef.current.filter(t => {
                    t.y -= 0.5 * dt;
                    t.life -= 0.02 * dt;
                    return t.life > 0;
                });

                // --- WORLD UPDATES (Run during PLAYING or dying or SPECTATING) ---
                if (gameState === GameState.PLAYING || (deathSequenceRef.current && deathSequenceRef.current.step === 'dying') || (multiplayer?.isActive && gameState === GameState.GAME_OVER)) {
                    // Update Urgent Order Timer
                    if (activeOrderRef.current.active) {
                        activeOrderRef.current.timeLeft -= dt / 60;
                        if (activeOrderRef.current.timeLeft <= 0) {
                            activeOrderRef.current.active = false;
                            setUrgentOrderProgress(null);
                            SoundManager.play('crash');
                            setVedalMessage("URGENT ORDER EXPIRED! Too slow!||急件時間到！太慢了！");
                        } else {
                            setUrgentOrderProgress({
                                percent: activeOrderRef.current.timeLeft / activeOrderRef.current.maxTime,
                                timeLeft: activeOrderRef.current.timeLeft
                            });
                        }
                    }

                    // Train Logic
                    if (!multiplayer?.isActive || multiplayer?.isHost) {
                        // Autonomous movement for Solo or Host
                        // [觀戰修復] 使用 targetPos 而非 drone.pos,這樣觀戰時火車也會移動
                        const distFromTrain = (effectiveIsSpectating ? targetPos.x : drone.pos.x) - train.x;
                        if (!multiplayer?.isActive) {
                            // Solo mode logic (already exists - targeting current drone)
                            if (distFromTrain > 1500) train.speed = 6.0;
                            else if (distFromTrain > 800) train.speed = 3.6;
                            else train.speed = 2.1 + ((effectiveIsSpectating ? targetPos.x : drone.pos.x) / 10000);
                        }
                        // Host uses the speed calculated in its effect
                        // [FIX] Remove * 0.6 factor to standardize speed across devices.
                        // Adjusted base speeds above to compensate (e.g. 3.5 -> 2.1)
                        train.x += train.speed * dt;
                    } else {
                        // Clients: Interpolate towards broadcast position
                        // [FIX] Add simple strict-sync compensation to prevent drifting
                        train.x += train.speed * dt;
                    }

                    if (trainGraceTimerRef.current > 0) {
                        trainGraceTimerRef.current -= dt / 60;
                    }

                    if (train.x > drone.pos.x - 50 && !drone.isGodMode && drone.health > 0 && !deathSequenceRef.current && trainGraceTimerRef.current <= 0) {
                        setFaceStatus('dead');
                        setVedalMessage("HYPE OVERLOAD! TOO SLOW!||發燒列車爆炸！太慢了！");
                        lastDamageSource.current = 'TRAIN';
                        triggerDeathSequence(drone.pos, 'TRAIN', Math.floor(maxDistanceRef.current / 10), trajectoryRef.current, cargoTrajectoryRef.current, levelRef.current.train.x);
                    }

                    // Refined Checkpoint Destruction Logic (Solo & Multiplayer)
                    const trainFront = train.x + train.w;
                    const currentWalls = levelRef.current.walls;

                    // Identify checkpoints to destroy this frame (contact with train front)
                    const hitCheckpoints = currentWalls.filter(w =>
                        w.type === 'checkpoint' && trainFront > w.x
                    );

                    if (hitCheckpoints.length > 0) {
                        hitCheckpoints.forEach(cp => {
                            SoundManager.play('crash');

                            // Visual FX: Spawn Debris around THIS specific checkpoint
                            const pieces: Debris[] = [];
                            for (let i = 0; i < 15; i++) {
                                const angle = Math.random() * Math.PI * 2;
                                const speed = 3 + Math.random() * 6;
                                pieces.push({
                                    x: cp.x + (Math.random() * cp.w),
                                    y: cp.y + (Math.random() * cp.h),
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed - 5,
                                    angle: Math.random() * Math.PI * 2,
                                    va: (Math.random() - 0.5) * 0.5,
                                    size: 5 + Math.random() * 8,
                                    color: '#10b981', // Checkpoint Emerald green
                                    life: 1.0
                                });
                            }
                            debrisRef.current = [...debrisRef.current, ...pieces];
                        });

                        // Remove only the checkpoints that have been hit/passed
                        levelRef.current.walls = currentWalls.filter(w =>
                            !(w.type === 'checkpoint' && trainFront > w.x)
                        );
                    }
                }

                // Hit Stop Logic: ALWAYS decay while loop is running to prevent freezes
                if (hitStopRef.current > 0) {
                    hitStopRef.current -= dt;
                } else if (gameState === GameState.PLAYING && drone.health > 0) {
                    frameCounterRef.current++;
                    if (drone.invincibleTimer > 0) drone.invincibleTimer -= dt / 60;

                    // --- GHOST RECORDING ---
                    if (drone.health > 0) {
                        trajectoryTimerRef.current += dt;
                        if (trajectoryTimerRef.current >= 6) {
                            trajectoryTimerRef.current = 0;
                            const newPos = { x: Math.round(drone.pos.x), y: Math.round(drone.pos.y) };
                            const newCargoPos = { x: Math.round(cargo.pos.x), y: Math.round(cargo.pos.y) };
                            trajectoryRef.current.push(newPos);
                            cargoTrajectoryRef.current.push(newCargoPos);
                            if (onUpdateTrajectory) onUpdateTrajectory(trajectoryRef.current, cargoTrajectoryRef.current);
                        }
                    }

                    // Generate Powerups from Train
                    if (Math.random() < 0.005) {
                        const pTypeRand = Math.random();
                        let pType: 'FUEL' | 'REPAIR' | 'SHIELD' = 'FUEL';
                        if (pTypeRand < 0.4) pType = 'FUEL';
                        else if (pTypeRand < 0.7) pType = 'REPAIR';
                        else pType = 'SHIELD';

                        levelData.powerups.push({
                            x: train.x + train.w / 2,
                            y: train.y + train.h,
                            vel: { x: (Math.random() - 0.5) * 5 + 5, y: -5 }, // Fling forward
                            radius: 12,
                            collected: false,
                            type: pType,
                            onGround: false
                        });
                    }

                    let effectiveInput: InputState;

                    if (difficulty === 'EASY') {
                        // --- EASY MODE CONTROL LOGIC ---
                        let targetAngle = drone.angle;
                        let shouldThrust = false;

                        // Priority: Joystick -> Mouse (Fallback)
                        // FIX: If isMobileMode, DO NOT fall back to mouse logic to prevent ghost touches
                        if (joystickRef.current.active) {
                            const { x, y } = joystickRef.current;
                            targetAngle = Math.atan2(y, x) + Math.PI / 2;

                            const mag = Math.sqrt(x * x + y * y);
                            shouldThrust = mag > 0.2;
                        } else if (!isMobileMode) {
                            // Mouse Control (Fallback - Desktop only)
                            const worldMouseX = mousePosRef.current.x - cameraRef.current.x;
                            const worldMouseY = mousePosRef.current.y - cameraRef.current.y;
                            const dx = worldMouseX - drone.pos.x;
                            const dy = worldMouseY - drone.pos.y;
                            const distToMouse = Math.sqrt(dx * dx + dy * dy);

                            targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
                            shouldThrust = distToMouse > 50;
                        }

                        let angleDiff = targetAngle - drone.angle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                        // Smooth follow instead of instant snap/overlap
                        // Using a reasonable multiplier that doesn't oscillate
                        const targetAngVel = (angleDiff * 0.3) / Math.max(0.1, dt);
                        // allow physical forces (like collisions) to influence angular velocity briefly
                        drone.angularVel += (targetAngVel - drone.angularVel) * 0.2;

                        effectiveInput = {
                            up: shouldThrust,
                            left: false,
                            right: false,
                            timestamp: time
                        };

                        if (!hasLaunchedRef.current && (shouldThrust || keysPressed.current[controls.keys.thrust?.toLowerCase()] || keysPressed.current[controls.keys.left?.toLowerCase()] || keysPressed.current[controls.keys.right?.toLowerCase()])) {
                            hasLaunchedRef.current = true;
                            drone.pos.y -= 2;
                        }

                    } else {
                        // --- NORMAL (WASD/CUSTOM) CONTROL LOGIC ---
                        const { keys } = controls;
                        const checkKey = (key: string) => {
                            return keysPressed.current[key.toLowerCase()] ||
                                keysPressed.current[key.toUpperCase()] ||
                                false;
                        };

                        const rawInput: InputState = {
                            up: checkKey(keys.thrust),
                            left: checkKey(keys.left),
                            right: checkKey(keys.right),
                            timestamp: time
                        };

                        if (!hasLaunchedRef.current && (rawInput.up || rawInput.left || rawInput.right)) {
                            hasLaunchedRef.current = true;
                            drone.pos.y -= 2;
                        }

                        inputQueueRef.current.push(rawInput);
                        const isLagging = persona === Persona.NEURO && Math.random() < Constants.NEURO_LAG_CHANCE;
                        if (isLagging && inputLagTimer <= 0) {
                            inputLagTimer = isMobileMode ? 15 : 30;
                            setVedalMessage("Neuro? Are you listening? (Lag Spike)||Neuro？你有在聽嗎？(延遲突波)");
                            setFaceStatus('panic');
                        }
                        const lagFrames = inputLagTimer > 0 ? (isMobileMode ? 8 : 20) : 0;
                        inputLagTimer--;
                        effectiveInput = inputQueueRef.current.length > lagFrames ? inputQueueRef.current.shift()! : rawInput;
                    }

                    const thrustMult = (persona === Persona.EVIL ? Constants.EVIL_THRUST : Constants.NEURO_THRUST) * (1 + upgrades.engineLevel * 0.1);

                    let fuelCost = (persona === Persona.EVIL ? Constants.EVIL_FUEL_CONSUMPTION : Constants.NEURO_FUEL_CONSUMPTION) * (difficulty === 'EASY' ? 0.8 : 1.0);
                    if (isEcoMode) fuelCost *= 0.8;

                    let activeGravity = Constants.GRAVITY;

                    levelData.gasZones.forEach(zone => {
                        if (MathUtils.rectIntersect(drone.pos, drone.radius, zone)) {
                            zone.timer += dt;
                            const flipInterval = 120;
                            const cycle = Math.floor(zone.timer / flipInterval);
                            if (cycle % 2 !== 0) {
                                zone.gravityScale = -1;
                                activeGravity = -Constants.GRAVITY * 0.8;
                                if (!gasMessageShown && Math.random() < 0.05) {
                                    setVedalMessage("COPIUM LEVELS CRITICAL. Gravity failing.||Copium 濃度過高。重力失效中。");
                                    gasMessageShown = true;
                                    setFaceStatus('panic');
                                }
                            } else {
                                zone.gravityScale = 1;
                                activeGravity = Constants.GRAVITY;
                            }
                        } else {
                            zone.timer = 0;
                        }
                    });

                    // Tutel Logic
                    let tutelWeight = 0;
                    let tutelDrag = 0;
                    const isInvincible = drone.invincibleTimer > 0 || drone.isGodMode;

                    levelData.tutels.forEach(tutel => {
                        if (tutel.state === 'yeeted') {
                            tutel.pos = MathUtils.add(tutel.pos, MathUtils.mult(tutel.vel, dt));
                            return;
                        }
                        const distToDrone = MathUtils.dist(tutel.pos, drone.pos);
                        if (tutel.state === 'idle') {
                            if (distToDrone < Constants.TUTEL_AGGRO_RANGE) tutel.state = 'chasing';
                        } else if (tutel.state === 'chasing') {
                            const dir = MathUtils.normalize(MathUtils.sub(drone.pos, tutel.pos));
                            tutel.vel = MathUtils.mult(dir, Constants.TUTEL_SPEED);
                            tutel.pos = MathUtils.add(tutel.pos, MathUtils.mult(tutel.vel, dt));
                            if (distToDrone < drone.radius + tutel.radius) {
                                if (!isInvincible) {
                                    tutel.state = 'attached';
                                    SoundManager.play('damage');
                                    if (!swarmMessageShown) {
                                        setVedalMessage("Tutel swarm! SPIN to shake them off!||烏龜群！快旋轉把牠們甩掉！");
                                        swarmMessageShown = true;
                                    }
                                } else {
                                    tutel.vel = MathUtils.mult(dir, -5);
                                    tutel.pos = MathUtils.add(tutel.pos, MathUtils.mult(tutel.vel, dt));
                                }
                            }
                        } else if (tutel.state === 'attached') {
                            tutelWeight += Constants.TUTEL_WEIGHT_PENALTY;
                            tutelDrag += Constants.TUTEL_DRAG_PENALTY;
                            tutel.pos = MathUtils.add(drone.pos, { x: Math.random() * 4 - 2, y: Math.random() * 4 - 2 });
                            if (isInvincible || Math.abs(drone.angularVel) > Constants.SHAKE_OFF_THRESHOLD) {
                                tutel.state = 'yeeted';
                                tutel.vel = MathUtils.mult({ x: Math.cos(drone.angle), y: Math.sin(drone.angle) }, 10);
                                setVedalMessage("Yeet!||走開！");
                                SoundManager.play('thrust');
                            }
                        }
                    });

                    // Drone Physics
                    if (drone.fuel > 0 || drone.isGodMode) {
                        fuelEmptyFramesRef.current = 0;
                        if (effectiveInput.up) {
                            const forceX = Math.sin(drone.angle) * thrustMult;
                            const forceY = -Math.cos(drone.angle) * thrustMult;
                            drone.vel.x += forceX * dt;
                            drone.vel.y += forceY * dt;
                            drone.thrustPower = 1;
                            drone.fuel -= fuelCost * dt;
                            SoundManager.play('thrust');
                        } else {
                            drone.thrustPower = 0;
                        }
                    } else {
                        drone.fuel = 0;
                        drone.thrustPower = 0;
                        fuelEmptyFramesRef.current += dt;
                        if (fuelEmptyFramesRef.current > 60 && fuelEmptyFramesRef.current < 70) {
                            setVedalMessage("OUT OF FUEL! Gliding...||燃料耗盡！滑行中...");
                            setFaceStatus('panic');
                        }
                    }

                    if (difficulty !== 'EASY') {
                        const rotStep = Constants.ROTATION_SPEED * dt * 0.1;
                        if (effectiveInput.left) drone.angularVel -= rotStep;
                        if (effectiveInput.right) drone.angularVel += rotStep;
                    }

                    drone.vel.y += (activeGravity + tutelWeight) * dt;
                    const currentDrag = Constants.DRAG - tutelDrag;
                    drone.vel = MathUtils.mult(drone.vel, Math.pow(currentDrag, dt));

                    // Sonic Boost: short burst of forward speed after each sonic boom
                    if (sonicBoostTimerRef.current > 0) {
                        sonicBoostTimerRef.current -= dt;
                        const boostStrength = (sonicBoostTimerRef.current / 30) * 0.25; // decay from 0.25 to 0
                        const spd = MathUtils.mag(drone.vel);
                        if (spd > 0.5) {
                            drone.vel.x += (drone.vel.x / spd) * boostStrength * dt;
                            drone.vel.y += (drone.vel.y / spd) * boostStrength * dt;
                        }
                    }

                    drone.angularVel *= Math.pow(Constants.ANGULAR_DRAG, dt);
                    drone.angle += drone.angularVel * dt;
                    drone.pos = MathUtils.add(drone.pos, MathUtils.mult(drone.vel, dt));

                    // --- [PERFORMANCE FIX] UPDATE & CLEANUP PARTICLES ---
                    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                        const p = particlesRef.current[i];
                        p.x += p.vx * dt;
                        p.y += p.vy * dt;
                        p.life -= dt / 60;
                        if (p.life <= 0) particlesRef.current.splice(i, 1);
                    }

                    // Update Sonic Booms
                    for (let i = sonicBoomsRef.current.length - 1; i >= 0; i--) {
                        const sb = sonicBoomsRef.current[i];
                        sb.radius += 5 * dt;
                        sb.life -= 0.05 * dt;
                        if (sb.life <= 0) sonicBoomsRef.current.splice(i, 1);
                    }

                    for (let i = debrisRef.current.length - 1; i >= 0; i--) {
                        const d = debrisRef.current[i];
                        d.x += d.vx * dt;
                        d.y += d.vy * dt;
                        d.angle += d.vAngle * dt;
                        d.life -= dt / 60; // Debris life is also in seconds
                        if (d.life <= 0) debrisRef.current.splice(i, 1);
                    }

                    for (let i = damageTextsRef.current.length - 1; i >= 0; i--) {
                        const t = damageTextsRef.current[i];
                        t.y -= 1 * dt; // Float up slower
                        t.life -= dt / 60;
                        if (t.life <= 0) damageTextsRef.current.splice(i, 1);
                    }

                    // --- Wind sound update ---
                    const speed = MathUtils.mag(drone.vel);
                    if (!SoundManager.windNodes) SoundManager.startWind();
                    SoundManager.updateWind(speed);

                    // --- 實時頭像表情觸發邏輯 ---
                    // distFromTrain 已在上方第 496 行宣告，此處直接使用
                    const isLowFuel = (drone.fuel / drone.maxFuel) < 0.2;

                    // 優先級：死亡 > 獲勝 > 慌張 (低油/近車) > 高速 > 閒置
                    const dft = drone.pos.x - train.x;
                    if (gameState === GameState.PLAYING || gameState === GameState.TUTORIAL) {
                        const speed = MathUtils.mag(drone.vel);
                        if (speed > Constants.HIGH_SPEED_THRESHOLD) {
                            highSpeedTimerRef.current = Math.min(
                                Constants.HIGH_SPEED_DELAY + Constants.HIGH_SPEED_COOLDOWN,
                                highSpeedTimerRef.current + dt
                            );
                        } else {
                            highSpeedTimerRef.current = Math.max(0, highSpeedTimerRef.current - dt);
                        }

                        // Trigger high speed mode after delay
                        const wasHighSpeed = isHighSpeedRef.current;
                        isHighSpeedRef.current = highSpeedTimerRef.current > Constants.HIGH_SPEED_DELAY;

                        if (isHighSpeedRef.current) {
                            if (!wasHighSpeed) {
                                sonicBoomsRef.current.push({ x: drone.pos.x, y: drone.pos.y, radius: 20, life: 1.0 });
                                damageTextsRef.current.push({ x: drone.pos.x, y: drone.pos.y - 40, text: "SONIC BREAKER!!", life: 1.5 });
                                SoundManager.play('boost');
                                lastBoostDistRef.current = drone.pos.x;
                                sonicBoostTimerRef.current = 30; // ~0.5s burst
                            }

                            // Repeated sonic boom every 5000px (~500m) during high speed
                            if (drone.pos.x - lastBoostDistRef.current >= 2500) {
                                sonicBoomsRef.current.push({ x: drone.pos.x, y: drone.pos.y, radius: 20, life: 1.0 });
                                SoundManager.play('boost');
                                lastBoostDistRef.current = drone.pos.x;
                                sonicBoostTimerRef.current = 30; // ~0.5s burst
                            }

                            shakeRef.current += 0.5 * dt; // Dynamic shake
                            if (shakeRef.current > 4) shakeRef.current = 4;

                            // 2. Persona Specific Particles Spawning
                            if (Math.random() < 0.4) {
                                if (persona === Persona.NEURO) {
                                    particlesRef.current.push({
                                        x: drone.pos.x,
                                        y: drone.pos.y,
                                        vx: -drone.vel.x * 0.2 + (Math.random() - 0.5) * 2,
                                        vy: -drone.vel.y * 0.2 + (Math.random() - 0.5) * 2,
                                        life: 1.0,
                                        size: 14 + Math.random() * 6,
                                        color: '#4ade80',
                                        text: Math.random() > 0.5 ? '0' : '1'
                                    });
                                } else if (persona === Persona.EVIL) {
                                    particlesRef.current.push({
                                        x: drone.pos.x + (Math.random() - 0.5) * 20,
                                        y: drone.pos.y + (Math.random() - 0.5) * 20,
                                        vx: -drone.vel.x * 0.1 + (Math.random() - 0.5) * 3,
                                        vy: -drone.vel.y * 0.1 + (Math.random() - 0.5) * 3,
                                        life: 1.0,
                                        size: 4 + Math.random() * 8,
                                        color: Math.random() > 0.4 ? '#ef4444' : '#111827'
                                    });
                                }
                            }

                            // Trail recording: Every 2 frames
                            trailTimerRef.current += dt;
                            if (trailTimerRef.current >= 2) {
                                trailTimerRef.current = 0;
                                trailRef.current.unshift({ x: drone.pos.x, y: drone.pos.y, angle: drone.angle });
                                if (trailRef.current.length > 10) trailRef.current.pop();

                                // 3. Friction Sparks (Near walls)
                                levelData.walls.forEach(w => {
                                    if (Math.abs(w.x + w.w / 2 - drone.pos.x) < w.w / 2 + 40 &&
                                        Math.abs(w.y + w.h / 2 - drone.pos.y) < w.h / 2 + 40) {
                                        // Close to a wall
                                        for (let j = 0; j < 2; j++) {
                                            particlesRef.current.push({
                                                x: drone.pos.x,
                                                y: drone.pos.y,
                                                vx: -drone.vel.x * 0.5 + (Math.random() - 0.5) * 5,
                                                vy: -drone.vel.y * 0.5 + (Math.random() - 0.5) * 5,
                                                life: 0.8,
                                                size: 2 + Math.random() * 3,
                                                color: '#facc15' // Yellow sparks
                                            });
                                        }
                                    }
                                });
                            }

                            // Record rotor glow trail every frame for smooth lines
                            if (isHighSpeedRef.current) {
                                const rotorSpan = 32;
                                const perpX = Math.cos(drone.angle);
                                const perpY = Math.sin(drone.angle);
                                rotorGlowTrailRef.current.left.unshift(
                                    { x: drone.pos.x + perpX * rotorSpan, y: drone.pos.y + perpY * rotorSpan, life: 1.0 }
                                );
                                rotorGlowTrailRef.current.right.unshift(
                                    { x: drone.pos.x - perpX * rotorSpan, y: drone.pos.y - perpY * rotorSpan, life: 1.0 }
                                );
                                if (rotorGlowTrailRef.current.left.length > 40) rotorGlowTrailRef.current.left.pop();
                                if (rotorGlowTrailRef.current.right.length > 40) rotorGlowTrailRef.current.right.pop();
                            }

                            // Decay rotor glow trail
                            [rotorGlowTrailRef.current.left, rotorGlowTrailRef.current.right].forEach(arr => {
                                for (let ri = arr.length - 1; ri >= 0; ri--) {
                                    arr[ri].life -= 0.04 * dt;
                                    if (arr[ri].life <= 0) arr.splice(ri, 1);
                                }
                            });
                        } else {
                            if (trailRef.current.length > 0) {
                                trailTimerRef.current += dt;
                                if (trailTimerRef.current >= 2) {
                                    trailTimerRef.current = 0;
                                    trailRef.current.pop(); // Fade out trail
                                }
                            }
                            // Clear rotor glow trail when not in high speed
                            rotorGlowTrailRef.current.left.length = 0;
                            rotorGlowTrailRef.current.right.length = 0;
                        }

                        if (drone.health <= 0 || drone.fuel <= 0) {
                            // 交給原本的 crash 邏輯，但這裡可以確保表情同步
                        } else if (dft < 200 || isLowFuel) {
                            setFaceStatus('panic');
                        } else if (isHighSpeedRef.current) {
                            setFaceStatus('fast'); // [High Speed Exception]
                        } else if (speed > 10) {
                            setFaceStatus('fast');
                        } else {
                            setFaceStatus('idle');
                        }
                    }

                    if (cargo.connected) {
                        cargo.vel.y += activeGravity * dt;
                        cargo.vel = MathUtils.mult(cargo.vel, Math.pow(Constants.DRAG, dt));
                        const distVec = MathUtils.sub(cargo.pos, drone.pos);
                        const distance = MathUtils.mag(distVec);
                        if (distance > Constants.ROPE_LENGTH) {
                            const ropeDir = MathUtils.normalize(distVec);
                            const stretch = distance - Constants.ROPE_LENGTH;
                            const totalForce = MathUtils.mult(ropeDir, stretch * Constants.ROPE_K + MathUtils.dot(MathUtils.sub(cargo.vel, drone.vel), ropeDir) * Constants.ROPE_DAMPING);
                            drone.vel = MathUtils.add(drone.vel, MathUtils.mult(totalForce, 0.05 * dt));
                            cargo.vel = MathUtils.sub(cargo.vel, MathUtils.mult(totalForce, 1.0 * dt));
                        }
                        cargo.pos = MathUtils.add(cargo.pos, MathUtils.mult(cargo.vel, dt));
                    } else {
                        cargo.vel.y += Constants.GRAVITY * dt;
                        cargo.pos = MathUtils.add(cargo.pos, MathUtils.mult(cargo.vel, dt));
                    }

                    levelData.coins.forEach(coin => {
                        if (!coin.collected) {
                            const distDrone = MathUtils.dist(drone.pos, { x: coin.x, y: coin.y });
                            const distCargo = cargo.connected ? MathUtils.dist(cargo.pos, { x: coin.x, y: coin.y }) : Infinity;
                            const pickupRadius = drone.radius + coin.radius + (isMagnet ? 50 : 0);

                            if (distDrone < pickupRadius || distCargo < cargo.radius + coin.radius) {
                                coin.collected = true;
                                addMoney(coin.value);
                                SoundManager.play('coin');
                                setVedalMessage(`Collected $${coin.value}!||撿到 $${coin.value}！`);

                                // [MULTIPLAYER] Sync coin collection
                                if (multiplayer?.isActive && multiplayer.manager) {
                                    multiplayer.manager.broadcast({
                                        type: 'PICKUP_COLLECT',
                                        pickupType: 'COIN',
                                        x: coin.x,
                                        y: coin.y
                                    });
                                }
                            }
                        }
                    });

                }




                // Urgent Order Logic
                levelData.urgentOrders.forEach(order => {
                    if (!order.collected) {
                        const distDrone = MathUtils.dist(drone.pos, { x: order.x, y: order.y });
                        const distCargo = cargo.connected ? MathUtils.dist(cargo.pos, { x: order.x, y: order.y }) : Infinity;
                        const pickupRadius = drone.radius + order.radius + (isMagnet ? 50 : 0);

                        if (distDrone < pickupRadius || distCargo < cargo.radius + order.radius) {
                            order.collected = true;
                            addMoney(50); // Small immediate reward

                            // Start Challenge
                            const timeLimit = 45; // 45 Seconds
                            activeOrderRef.current = { active: true, timeLeft: timeLimit, maxTime: timeLimit };
                            setUrgentOrderProgress({ percent: 1, timeLeft: timeLimit });

                            SoundManager.play('win');
                            setVedalMessage("RUSH ORDER START! Reach checkpoint in 45s!||急件任務開始！45秒內抵達存檔點！");

                            // [MULTIPLAYER] Sync order collection
                            if (multiplayer?.isActive && multiplayer.manager) {
                                multiplayer.manager.broadcast({
                                    type: 'PICKUP_COLLECT',
                                    pickupType: 'ORDER',
                                    x: order.x,
                                    y: order.y
                                });
                            }
                        }
                    }
                });

                levelData.powerups.forEach(p => {
                    if (!p.collected) {
                        if (!p.onGround) {
                            p.vel.y += Constants.GRAVITY * 0.5 * dt;
                            p.x += p.vel.x * dt;
                            p.y += p.vel.y * dt;
                            if (p.y > 900) { p.y = 900; p.vel = { x: 0, y: 0 }; p.onGround = true; }
                        }
                        const distDrone = MathUtils.dist(drone.pos, { x: p.x, y: p.y });

                        if (distDrone < drone.radius + p.radius) {
                            p.collected = true;
                            SoundManager.play('shop');
                            if (p.type === 'FUEL') {
                                drone.fuel = Math.min(drone.maxFuel, drone.fuel + drone.maxFuel * 0.3);
                                setVedalMessage("Refueled via canister.||撿到燃料罐。");
                            } else if (p.type === 'REPAIR') {
                                drone.health = Math.min(drone.maxHealth, drone.health + drone.maxHealth * 0.3);
                                setVedalMessage("Field repair successful.||野外維修成功。");
                            } else if (p.type === 'SHIELD') {
                                drone.invincibleTimer = 5;
                                setVedalMessage("SHIELD ACTIVE! 5 Seconds.||護盾啟動！5秒。");
                            }

                            // [MULTIPLAYER] Sync powerup collection
                            if (multiplayer?.isActive && multiplayer.manager) {
                                multiplayer.manager.broadcast({
                                    type: 'PICKUP_COLLECT',
                                    pickupType: 'POWERUP',
                                    x: p.x,
                                    y: p.y
                                });
                            }
                        }
                    }
                });

                const checkCollision = (entity: Drone | Cargo, isDrone: boolean) => {
                    const isInvincible = drone.invincibleTimer > 0 || drone.isGodMode;
                    let collided = false;

                    if (entity.pos.y > 4000) {
                        if (!isDrone || !drone.isGodMode) {
                            entity.health = 0;
                            if (isDrone) lastDamageSource.current = 'VOID';
                        } else {
                            entity.vel.y = -50;
                            setVedalMessage("God Mode Save.||上帝模式救援。");
                        }
                        collided = true;
                    }

                    levelData.walls.forEach(wall => {
                        const closestX = Math.max(wall.x, Math.min(entity.pos.x, wall.x + wall.w));
                        const closestY = Math.max(wall.y, Math.min(entity.pos.y, wall.y + wall.h));
                        const dx = entity.pos.x - closestX;
                        const dy = entity.pos.y - closestY;
                        const distSq = dx * dx + dy * dy;

                        if (distSq < entity.radius * entity.radius) {
                            const dist = Math.sqrt(distSq);

                            if (wall.type === 'checkpoint' && isDrone) {
                                const speed = MathUtils.mag(entity.vel);
                                if (speed < 5.0 && entity.pos.y < wall.y) {
                                    if (wall.x !== lastDeliveryWallX.current) {
                                        lastDeliveryWallX.current = wall.x;

                                        setLastCheckpoint({ x: wall.x + 200, y: wall.y - 20 });
                                        setGameState(GameState.CHECKPOINT_SHOP);
                                        SoundManager.play('shop');

                                        const bonus = Math.floor(cargoRef.current.health * 0.5);
                                        addMoney(bonus);

                                        cargoRef.current.health = cargoRef.current.maxHealth;

                                        // Check for Urgent Order Success
                                        let orderMsg = "";
                                        if (activeOrderRef.current.active) {
                                            const upgradeName = onGrantRandomUpgrade("");
                                            activeOrderRef.current.active = false;
                                            setUrgentOrderProgress(null);
                                            SoundManager.play('win');
                                            orderMsg = ` RUSH SUCCESS! FREE UPGRADE: ${upgradeName}.`;
                                        }

                                        setVedalMessage(`Shipment Delivered! +$${bonus}.${orderMsg}||貨物已送達！+$${bonus}。${orderMsg ? '急件完成！免費升級！' : '已更換新蘭姆酒。'}`);

                                        entity.vel = { x: 0, y: 0 };
                                        entity.angularVel = 0;
                                        entity.pos.y = wall.y - entity.radius;
                                        fuelEmptyFramesRef.current = 0;
                                        if (cargoRef.current.connected) cargoRef.current.vel = { x: 0, y: 0 };

                                        // [FIX] Record trajectory lengths at the Moment of checkpoint reach
                                        trajectoryCheckpointLengthRef.current = trajectoryRef.current.length;
                                        cargoTrajectoryCheckpointLengthRef.current = cargoTrajectoryRef.current.length;

                                        return;
                                    }
                                }
                            }

                            if (wall.type === 'hazard') {
                                if (isDrone && !isInvincible) {
                                    drone.health -= 2;
                                    lastDamageSource.current = 'LASER';
                                    setFaceStatus('panic');
                                    if (Math.random() < 0.2) SoundManager.play('damage');
                                } else if (!isDrone) {
                                    cargo.health -= 2;
                                }
                            }

                            let nx = 0, ny = 0, overlap = 0;
                            if (dist === 0) {
                                const dLeft = entity.pos.x - wall.x;
                                const dRight = (wall.x + wall.w) - entity.pos.x;
                                const dTop = entity.pos.y - wall.y;
                                const dBottom = (wall.y + wall.h) - entity.pos.y;
                                const min = Math.min(dLeft, dRight, dTop, dBottom);
                                if (min === dTop) ny = -1;
                                else if (min === dBottom) ny = 1;
                                else if (min === dLeft) nx = -1;
                                else nx = 1;
                                overlap = min + entity.radius;
                            } else {
                                nx = dx / dist; ny = dy / dist; overlap = entity.radius - dist;
                            }

                            entity.pos.x += nx * overlap;
                            entity.pos.y += ny * overlap;

                            const relVelX = entity.vel.x - (wall.vel?.x || 0);
                            const relVelY = entity.vel.y - (wall.vel?.y || 0);
                            const dot = relVelX * nx + relVelY * ny;

                            if (dot < 0) {
                                const oldVelX = relVelX;
                                const oldVelY = relVelY;

                                const j = -(1 + 0.4) * dot;
                                entity.vel.x += j * nx;
                                entity.vel.y += j * ny;
                                if (wall.vel) { entity.vel.x += wall.vel.x * 0.5; entity.vel.y += wall.vel.y * 0.5; }

                                const tx = -ny, ty = nx;
                                const tDot = entity.vel.x * tx + entity.vel.y * ty;
                                entity.vel.x -= tDot * 0.2 * tx;
                                entity.vel.y -= tDot * 0.2 * ty;

                                // --- Add refined collision-based rotation for drone ---
                                if (isDrone) {
                                    const newVelX = entity.vel.x;
                                    const newVelY = entity.vel.y;

                                    // Use cross product to determine deflection direction (CW or CCW)
                                    const cross = oldVelX * newVelY - oldVelY * newVelX;

                                    // 1. Angular impulse: match rotation to deflection direction
                                    const angularImpulse = cross * 0.005;
                                    drone.angularVel += angularImpulse;

                                    // 2. Align facing direction toward reflection vector (subtle)
                                    const impactSpeed = Math.abs(dot);
                                    if (Math.abs(newVelX) > 0.1 || Math.abs(newVelY) > 0.1) {
                                        const targetBounceAngle = Math.atan2(newVelY, newVelX) + Math.PI / 2;
                                        const turnFactor = Math.min(0.2, impactSpeed * 0.03);

                                        let angleDiff = targetBounceAngle - drone.angle;
                                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                                        drone.angle += angleDiff * turnFactor;
                                    }
                                }

                                // 3. Visual Feedback Triggers
                                const impactSpeed = Math.abs(dot);
                                if (impactSpeed > 2) {
                                    shakeRef.current = Math.min(20, shakeRef.current + impactSpeed * 1.5);

                                    // Emit Particles
                                    const particleCount = Math.floor(impactSpeed * 3);
                                    for (let i = 0; i < particleCount; i++) {
                                        const angle = Math.random() * Math.PI * 2;
                                        const speed = Math.random() * impactSpeed * 0.5;
                                        particlesRef.current.push({
                                            x: entity.pos.x + nx * entity.radius,
                                            y: entity.pos.y + ny * entity.radius,
                                            vx: Math.cos(angle) * speed + nx * impactSpeed * 0.2,
                                            vy: Math.sin(angle) * speed + ny * impactSpeed * 0.2,
                                            life: 0.5 + Math.random() * 0.5,
                                            color: impactSpeed > 8 ? '#facc15' : '#cbd5e1',
                                            size: 1 + Math.random() * 2
                                        });
                                    }

                                    if (impactSpeed > 10) {
                                        hitStopRef.current = 6; // ~100ms
                                        damageTextsRef.current.push({
                                            x: entity.pos.x,
                                            y: entity.pos.y - 40,
                                            text: "CRASH!",
                                            life: 1.0
                                        });
                                    }
                                }

                                // 4. Damage Logic
                                if (impactSpeed > Constants.DAMAGE_THRESHOLD) {
                                    let damage = Math.floor(impactSpeed * 5);
                                    if (isArmored) damage = Math.floor(damage * 0.7);

                                    if (isDrone) {
                                        if (!isInvincible) {
                                            drone.health -= damage;
                                            lastDamageSource.current = 'WALL';
                                            setFaceStatus('panic');
                                            SoundManager.play('damage');
                                            damageFlashRef.current = 1.0;
                                        }
                                    } else {
                                        cargo.health -= damage;
                                        damageFlashRef.current = 0.5;
                                    }
                                }
                            }
                            collided = true;
                        }
                    });
                    return collided;
                };

                checkCollision(drone, true);
                if (cargo.connected) checkCollision(cargo, false);

                if (drone.health <= 0 && !deathSequenceRef.current) {
                    triggerDeathSequence(drone.pos, lastDamageSource.current, Math.floor(maxDistanceRef.current / 10), trajectoryRef.current, cargoTrajectoryRef.current, levelRef.current.train.x);
                } else if (fuelEmptyFramesRef.current > 180 && !deathSequenceRef.current) {
                    triggerDeathSequence(drone.pos, 'FUEL', Math.floor(maxDistanceRef.current / 10), trajectoryRef.current, cargoTrajectoryRef.current, levelRef.current.train.x);
                } else if (cargo.health <= 0 && cargo.connected) {
                    cargo.connected = false;
                    setVedalMessage("Rum broken! Mission Failed.||蘭姆酒碎了！任務失敗。");
                    setFaceStatus('dead');
                    // Immediate trigger to avoid "vanishing" before debris starts
                    triggerDeathSequence(cargo.pos, 'CARGO', Math.floor(maxDistanceRef.current / 10), trajectoryRef.current, cargoTrajectoryRef.current, levelRef.current.train.x);
                }

                if (cargo.health > 0 && cargo.connected) {
                    if (cargo.pos.x > maxDistanceRef.current) maxDistanceRef.current = cargo.pos.x;
                }

                const hpPct = (drone.health / drone.maxHealth) * 100;
                const fuelPct = (drone.fuel / drone.maxFuel) * 100;
                const cargoPct = (cargo.health / cargo.maxHealth) * 100;

                const scaledDistance = Math.floor(maxDistanceRef.current / 10);
                const distToNext = Math.floor(Math.max(0, nextCheckpointX.current - cargo.pos.x) / 10);

                // Throttle UI updates to ~4fps (every 15 frames)
                statsThrottleTimer += dt;
                if (statsThrottleTimer >= 15) {
                    const speed = MathUtils.mag(drone.vel);
                    setStats(hpPct, fuelPct, cargoPct, scaledDistance, distToNext, speed, equippedItem, levelRef.current.train.x, isHighSpeedRef.current);
                    statsThrottleTimer = 0;
                }

                // --- Multiplayer Sync ---
                if (multiplayer?.isActive && multiplayer.manager) {
                    mpSyncTimerRef.current += dt;
                    // Low: 4 TPS (15 frames), Med: 10 TPS (6 frames), High: 20 TPS (3 frames)
                    const currentRate = mpUpdateRateRef.current; // Read from ref
                    // [優化] Low: 10 TPS (6 frames), Med: 15 TPS (4 frames), High: 20 TPS (3 frames)
                    const syncInterval = currentRate === 'low' ? 6 : currentRate === 'med' ? 4 : 3;
                    if (mpSyncTimerRef.current >= syncInterval) {
                        mpSyncTimerRef.current -= syncInterval; // Maintain accumulation for accurate pacing
                        multiplayer.manager.broadcast({
                            type: 'PLAYER_STATE',
                            pos: drone.pos,
                            angle: drone.angle,
                            health: drone.health,
                            persona,
                            cargoPos: cargo.pos,
                            cargoAngle: cargo.angle,
                            thrustPower: drone.thrustPower,
                            // [SPECTATOR SYNC] Broadcast UI stats
                            fuel: fuelPct,
                            hpPercent: hpPct,
                            cargoHealth: cargoPct,
                            scoreDistance: scaledDistance,
                            distToNext
                        });
                        mpSyncTimerRef.current = 0;
                    }
                }

                // [玩家碰撞] 輕量級碰撞檢測(客戶端本地計算)
                // [開局保護] 只有玩家起飛後才啟用碰撞
                if (multiplayer?.isActive && drone.health > 0 && !deathSequenceRef.current && hasLaunchedRef.current) {
                    multiplayer.remotePlayers.forEach(rp => {
                        if (rp.health <= 0) return; // 跳過死亡玩家

                        const dx = drone.pos.x - rp.pos.x;
                        const dy = drone.pos.y - rp.pos.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const minDist = drone.radius + 15; // 遠程玩家半徑

                        if (dist < minDist && dist > 0) {
                            // 碰撞!產生彈開效果
                            const overlap = minDist - dist;
                            const nx = dx / dist; // 法向量
                            const ny = dy / dist;

                            // 彈開本地玩家
                            drone.pos.x += nx * overlap * 0.5;
                            drone.pos.y += ny * overlap * 0.5;
                            drone.vel.x += nx * 2;
                            drone.vel.y += ny * 2;

                            // 視覺效果
                            shakeRef.current = Math.max(shakeRef.current, 5);
                            SoundManager.play('damage'); // 使用碰撞音效

                            // 粒子效果
                            for (let i = 0; i < 8; i++) {
                                const angle = Math.random() * Math.PI * 2;
                                particlesRef.current.push({
                                    x: (drone.pos.x + rp.pos.x) / 2,
                                    y: (drone.pos.y + rp.pos.y) / 2,
                                    vx: Math.cos(angle) * 3,
                                    vy: Math.sin(angle) * 3,
                                    life: 1.0,
                                    color: '#fbbf24' // 金色碰撞火花
                                });
                            }
                        }
                    });
                }
            }


            // --- RENDERING ---
            if (!ctx.canvas) return;
            const width = ctx.canvas.width;
            const height = ctx.canvas.height;

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, width, height);

            if (effectiveIsSpectating) {
                // Show Spectating Text
                ctx.save();
                ctx.font = 'bold 30px VT323';
                ctx.fillStyle = '#facc15';
                ctx.textAlign = 'center';
                ctx.fillText("SPECTATING MODE", width / 2, height - 100);
                if (spectatorTargetId) ctx.fillText(`WATCHING: ${spectatorTargetId.slice(-4)}`, width / 2, height - 70);
                ctx.restore();
            }




            const targetCamX = -targetPos.x + width * 0.3;
            const targetCamY = -targetPos.y + height / 2;
            cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
            cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;

            ctx.save();
            // --- Apply Screen Shake ---
            const sx = (Math.random() - 0.5) * shakeRef.current;
            const sy = (Math.random() - 0.5) * shakeRef.current;

            // Dynamic Zoom (FOV) — unified: old 0.92 internal + 1.02 CSS ≈ 0.94
            const zoomTarget = isHighSpeedRef.current ? 0.94 : 1.0;
            currentZoomRef.current += (zoomTarget - currentZoomRef.current) * 0.05;
            const currentZoom = currentZoomRef.current;

            if (currentZoom !== 1.0) {
                ctx.translate(width / 2, height / 2);
                ctx.scale(currentZoom, currentZoom);
                ctx.translate(-width / 2, -height / 2);
            }

            ctx.translate(cameraRef.current.x + sx, cameraRef.current.y + sy);

            // --- RENDER PARALLAX STREAKS (Background) ---
            if (isHighSpeedRef.current) {
                if (parallaxStreaksRef.current.length === 0) {
                    for (let j = 0; j < 25; j++) {
                        parallaxStreaksRef.current.push({
                            x: Math.random() * width,
                            y: Math.random() * height,
                            length: 50 + Math.random() * 150,
                            speed: 10 + Math.random() * 20,
                            alpha: 0.1 + Math.random() * 0.2
                        });
                    }
                }

                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Screenspace relative
                ctx.lineWidth = 1;
                parallaxStreaksRef.current.forEach(s => {
                    s.x -= s.speed;
                    if (s.x + s.length < 0) {
                        s.x = width;
                        s.y = Math.random() * height;
                    }
                    ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`;
                    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.length, s.y); ctx.stroke();
                });
                ctx.restore();
            } else {
                parallaxStreaksRef.current = [];
            }

            // Render Walls
            levelData.walls.forEach(w => {
                if (w.type === 'hazard') {
                    const flicker = 0.5 + Math.sin(time * 0.05) * 0.2;
                    ctx.fillStyle = `rgba(255, 50, 50, ${flicker})`;
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                } else if (w.type === 'checkpoint') {
                    ctx.fillStyle = '#10b981';
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                    const text = w.x < 100 ? "START" : "CHECKPOINT";
                    ctx.fillStyle = '#d1fae5';
                    ctx.font = '20px VT323';
                    ctx.fillText(text + " - TUTEL MART", w.x + 20, w.y + 25);
                } else if (w.type === 'moving_wall') {
                    ctx.fillStyle = '#64748b';
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                    ctx.fillStyle = '#f59e0b';
                    for (let i = 0; i < w.h; i += 20) ctx.fillRect(w.x, w.y + i, w.w, 5);
                    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
                } else {
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(w.x, w.y, w.w, w.h);
                    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
                }
            });

            levelData.tutels.forEach(tutel => {
                ctx.save(); ctx.translate(tutel.pos.x, tutel.pos.y);
                ctx.fillStyle = '#22c55e';
                ctx.beginPath(); ctx.arc(0, 0, tutel.radius, 0, Math.PI * 2); ctx.fill();
                if (tutel.state === 'attached') {
                    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(drone.pos.x - tutel.pos.x, drone.pos.y - tutel.pos.y); ctx.stroke();
                }
                ctx.restore();
            });

            levelData.powerups.forEach(p => {
                if (!p.collected) {
                    ctx.save(); ctx.translate(p.x, p.y);
                    ctx.fillStyle = p.type === 'FUEL' ? '#3b82f6' : p.type === 'REPAIR' ? '#ef4444' : '#06b6d4';
                    ctx.fillRect(-10, -10, 20, 20);
                    ctx.restore();
                }
            });
            levelData.coins.forEach(coin => {
                if (!coin.collected) {
                    ctx.save(); ctx.translate(coin.x, coin.y);
                    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, coin.radius, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                }
            });

            levelData.urgentOrders.forEach(order => {
                if (!order.collected) {
                    ctx.save(); ctx.translate(order.x, order.y);
                    const scale = 1 + Math.sin(time * 0.01) * 0.1;
                    ctx.scale(scale, scale);
                    ctx.fillStyle = '#a855f7'; ctx.fillRect(-15, -15, 30, 30);
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-15, -15, 30, 30);
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, 0);
                    ctx.restore();
                }
            });

            // Train
            ctx.save(); ctx.translate(train.x, train.y);
            ctx.fillStyle = '#8b5cf6'; ctx.fillRect(0, 0, train.w, train.h);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('HYPE', 10, 30);
            ctx.restore();

            // Drone & Cargo Rendering Logic
            const ds = deathSequenceRef.current;
            const isDying = ds && ds.step === 'dying';
            const isCargoDeath = ds?.reason === 'CARGO';

            // --- RENDER HIGH SPEED TRAIL & STREAMING LIGHT (流光) ---
            if (trailRef.current.length > 0) {
                // 1. Draw Streaming Light (流光) streaks
                if (isHighSpeedRef.current) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.lineWidth = 18;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    const gradient = ctx.createLinearGradient(drone.pos.x, drone.pos.y, trailRef.current[trailRef.current.length - 1].x, trailRef.current[trailRef.current.length - 1].y);
                    const color = persona === Persona.EVIL ? '#ef4444' : '#22d3ee';
                    gradient.addColorStop(0, color);
                    gradient.addColorStop(1, 'transparent');

                    ctx.strokeStyle = gradient;
                    ctx.globalAlpha = 0.7;
                    ctx.shadowBlur = 25;
                    ctx.shadowColor = color;

                    ctx.moveTo(drone.pos.x, drone.pos.y);
                    trailRef.current.forEach(p => ctx.lineTo(p.x, p.y));
                    ctx.stroke();
                    ctx.restore();
                }

                // 2. Draw Ghost Trails (殘影 - RGB Split + Glow Tail)
                trailRef.current.forEach((p, i) => {
                    const alpha = (1 - i / trailRef.current.length) * 0.4;
                    if (alpha <= 0) return;

                    const offset = i * 1.5; // Offset increases for older trails
                    const glowSize = 15 + (trailRef.current.length - i) * 2; // Newer = bigger glow

                    // Glow halo (comet tail)
                    if (isHighSpeedRef.current) {
                        ctx.save();
                        ctx.globalAlpha = alpha * 0.35;
                        const glowColor = persona === Persona.EVIL ? '#ef4444' : '#22d3ee';
                        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize * 1.8);
                        grd.addColorStop(0, glowColor);
                        grd.addColorStop(1, 'transparent');
                        ctx.fillStyle = grd;
                        ctx.beginPath(); ctx.arc(p.x, p.y, glowSize * 1.8, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                    }

                    // Red/Pink Channel
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.translate(p.x - offset, p.y);
                    ctx.rotate(p.angle);
                    ctx.fillStyle = '#f43f5e';
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();

                    // Cyan/Blue Channel
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.6;
                    ctx.translate(p.x + offset, p.y);
                    ctx.rotate(p.angle);
                    ctx.fillStyle = '#06b6d4';
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();

                    // Main Silhouette
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.angle);
                    ctx.fillStyle = persona === Persona.EVIL ? '#fca5a5' : '#a5f3fc';
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
            }

            // --- RENDER ROTOR GLOW TRAIL ---
            const rTrail = rotorGlowTrailRef.current;
            if (rTrail.left.length > 1 || rTrail.right.length > 1) {
                const glowColor = persona === Persona.EVIL ? '239, 68, 68' : '6, 182, 212';
                [rTrail.left, rTrail.right].forEach(arr => {
                    if (arr.length < 2) return;

                    // Draw as a single smooth path with linear gradient from head to tail
                    const head = arr[0];
                    const tail = arr[arr.length - 1];
                    const grad = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
                    grad.addColorStop(0, `rgba(${glowColor}, 0.85)`);
                    grad.addColorStop(0.3, `rgba(${glowColor}, 0.5)`);
                    grad.addColorStop(1, `rgba(${glowColor}, 0)`);

                    ctx.save();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(arr[0].x, arr[0].y);
                    for (let i = 1; i < arr.length; i++) {
                        ctx.lineTo(arr[i].x, arr[i].y);
                    }
                    ctx.stroke();
                    ctx.restore();

                    // Head dot
                    if (head.life > 0.3) {
                        ctx.save();
                        ctx.globalAlpha = head.life;
                        ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
                        ctx.beginPath(); ctx.arc(head.x, head.y, 2, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                    }
                });
            }

            // --- RENDER CARGO & ROPE ---
            // Local cargo/rope only render if drone is alive AND cargo hasn't been destroyed
            if (drone.health > 0 && cargo.health > 0) {
                if (cargo.connected) {
                    ctx.beginPath(); ctx.moveTo(drone.pos.x, drone.pos.y); ctx.lineTo(cargo.pos.x, cargo.pos.y);
                    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();
                }

                ctx.save(); ctx.translate(cargo.pos.x, cargo.pos.y);
                ctx.fillStyle = '#d97706'; ctx.fillRect(-cargo.radius, -cargo.radius, cargo.radius * 2, cargo.radius * 2);

                if (upgrades.cargoLevel > 0) {
                    ctx.strokeStyle = '#a3e635';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(-cargo.radius, -cargo.radius);
                    ctx.lineTo(cargo.radius, cargo.radius);
                    ctx.moveTo(cargo.radius, -cargo.radius);
                    ctx.lineTo(-cargo.radius, cargo.radius);
                    ctx.strokeRect(-cargo.radius - 2, -cargo.radius - 2, cargo.radius * 2 + 4, cargo.radius * 2 + 4);
                }
                ctx.restore();
            }

            // --- RENDER DRONE (Legacy Canvas Rendering Removed) ---
            // Now handled by React Overlay + CSS Transform Sync

            // --- RENDER DEBRIS ---
            debrisRef.current.forEach(deb => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, deb.life);
                ctx.translate(deb.x, deb.y);
                ctx.rotate(deb.angle);
                ctx.fillStyle = deb.color;
                ctx.fillRect(-deb.size / 2, -deb.size / 2, deb.size, deb.size);
                ctx.restore();
            });
            ctx.globalAlpha = 1.0;

            // --- RENDER SONIC BOOMS ---
            sonicBoomsRef.current.forEach(sb => {
                ctx.save();
                const boomColor = persona === Persona.EVIL ? [239, 68, 68] : [6, 182, 212];
                // Outer glow
                ctx.beginPath();
                ctx.strokeStyle = `rgba(${boomColor[0]}, ${boomColor[1]}, ${boomColor[2]}, ${sb.life * 0.3})`;
                ctx.lineWidth = 6 + sb.life * 8;
                ctx.shadowBlur = 20;
                ctx.shadowColor = `rgba(${boomColor[0]}, ${boomColor[1]}, ${boomColor[2]}, ${sb.life})`;
                ctx.arc(sb.x, sb.y, sb.radius, 0, Math.PI * 2);
                ctx.stroke();
                // Main ring
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${sb.life})`;
                ctx.lineWidth = 2 + sb.life * 4;
                ctx.shadowBlur = 10;
                ctx.shadowColor = `rgba(255, 255, 255, ${sb.life})`;
                ctx.arc(sb.x, sb.y, sb.radius, 0, Math.PI * 2);
                ctx.stroke();
                // Inner ring
                ctx.beginPath();
                ctx.arc(sb.x, sb.y, sb.radius * 0.6, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${boomColor[0]}, ${boomColor[1]}, ${boomColor[2]}, ${sb.life * 0.5})`;
                ctx.lineWidth = 1 + sb.life * 3;
                ctx.shadowBlur = 0;
                ctx.stroke();
                ctx.restore();
            });

            // --- RENDER PARTICLES ---
            particlesRef.current.forEach(p => {
                ctx.globalAlpha = p.life;
                if (p.text) {
                    ctx.fillStyle = p.color;
                    ctx.font = `bold ${p.size}px monospace`;
                    ctx.fillText(p.text, p.x - p.size / 2, p.y + p.size / 2);
                } else {
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
                }
            });
            ctx.globalAlpha = 1.0;

            // --- RENDER DAMAGE TEXTS ---
            damageTextsRef.current.forEach(t => {
                ctx.fillStyle = `rgba(255, 255, 255, ${t.life})`;
                ctx.strokeStyle = `rgba(0, 0, 0, ${t.life})`; ctx.lineWidth = 3;
                ctx.font = 'bold 24px VT323'; ctx.textAlign = 'center';
                ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
            });

            // --- RENDER REMOTE PLAYERS ---
            if (multiplayer?.isActive) {
                multiplayer.remotePlayers.forEach(p => {
                    if (!p.pos) return;
                    const isDead = p.health <= 0;

                    if (isDead) {
                        // Render Death X for remote players
                        const size = 10;
                        ctx.save();
                        ctx.translate(p.pos.x, p.pos.y);
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 3;
                        ctx.globalAlpha = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(-size, -size); ctx.lineTo(size, size);
                        ctx.moveTo(size, -size); ctx.lineTo(-size, size);
                        ctx.stroke();

                        // ID text above X
                        ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
                        ctx.font = '12px VT323';
                        ctx.textAlign = 'center';
                        ctx.fillText(p.id.slice(-4), 0, -15);
                        ctx.restore();
                        return; // Skip drone rendering for dead players
                    }

                    // Draw Rope & Cargo if available
                    if (p.cargoPos) {
                        ctx.beginPath();
                        ctx.moveTo(p.pos.x, p.pos.y);
                        ctx.lineTo(p.cargoPos.x, p.cargoPos.y);
                        ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        ctx.save();
                        ctx.translate(p.cargoPos.x, p.cargoPos.y);
                        if (p.cargoAngle !== undefined) ctx.rotate(p.cargoAngle);
                        ctx.fillStyle = 'rgba(217, 119, 6, 0.6)';
                        ctx.fillRect(-12, -12, 24, 24);
                        ctx.restore();
                    }

                    // Name/ID (Over the overlay? Or keep on canvas?)
                    // Keep Name on Canvas for now as overlays might not handle text easily without more DOM
                    ctx.save(); ctx.translate(p.pos.x, p.pos.y);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.font = '12px VT323'; ctx.textAlign = 'center';
                    ctx.fillText(p.id.slice(-4), 0, -35); // Moved up slightly
                    ctx.restore();
                });
            }

            // --- RENDER LOCAL PLAYER DEATH MARKER ---
            if (drone.health <= 0 && !isCargoDeath) {
                const size = 10;
                ctx.save();
                ctx.translate(drone.pos.x, drone.pos.y);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.moveTo(-size, -size); ctx.lineTo(size, size);
                ctx.moveTo(size, -size); ctx.lineTo(-size, size);
                ctx.stroke();
                // "YOU" text above X
                ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
                ctx.font = '12px VT323';
                ctx.textAlign = 'center';
                ctx.fillText("YOU", 0, -15);
                ctx.restore();
            }

            // --- RENDER GHOST ---
            if (ghostData && ghostData.trajectory && ghostData.trajectory.length > 0 && gameState === GameState.PLAYING) {
                const currentIndex = trajectoryRef.current.length;
                const lastPos = ghostData.trajectory[ghostData.trajectory.length - 1];
                if (lastPos) {
                    const size = 10; ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(lastPos.x - size, lastPos.y - size); ctx.lineTo(lastPos.x + size, lastPos.y + size);
                    ctx.moveTo(lastPos.x + size, lastPos.y - size); ctx.lineTo(lastPos.x - size, lastPos.y + size); ctx.stroke();
                }

                if (currentIndex < ghostData.trajectory.length) {
                    const ghostPos = ghostData.trajectory[currentIndex];
                    const ghostCargoPos = ghostData.cargoTrajectory ? ghostData.cargoTrajectory[currentIndex] : null;

                    if (ghostPos) {
                        // Render ghost rope if cargo exists
                        if (ghostCargoPos) {
                            ctx.save();
                            ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(ghostPos.x, ghostPos.y);
                            ctx.lineTo(ghostCargoPos.x, ghostCargoPos.y);
                            ctx.stroke();
                            ctx.restore();

                            // Render ghost cargo
                            ctx.save();
                            ctx.translate(ghostCargoPos.x, ghostCargoPos.y);
                            ctx.globalAlpha = 0.4;
                            ctx.fillStyle = '#06b6d4';
                            ctx.beginPath();
                            ctx.arc(0, 0, 12, 0, Math.PI * 2);
                            ctx.fill();
                            // Inner box effect
                            ctx.fillStyle = 'rgba(255,255,255,0.3)';
                            ctx.fillRect(-6, -6, 12, 12);
                            ctx.restore();
                        }

                        ctx.save();
                        ctx.translate(ghostPos.x, ghostPos.y);
                        ctx.globalAlpha = 0.5; ctx.fillStyle = '#06b6d4';
                        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 0.9;
                        ctx.fillStyle = 'white';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 3;
                        ctx.font = 'bold 16px "Courier New", monospace';
                        ctx.textAlign = 'center';
                        ctx.lineJoin = 'round';
                        const nameY = -35;
                        ctx.strokeText(ghostData.name, 0, nameY);
                        ctx.fillText(ghostData.name, 0, nameY);
                        ctx.restore();
                    }
                }
            }

            ctx.restore(); // World Camera Restore

            // [DEBUG] Tutorial On-Screen Info (Rendered LAST)
            if (gameState === GameState.TUTORIAL) {
                ctx.save();
                ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                ctx.fillRect(10, 10, 320, 230);
                ctx.fillStyle = "lime";
                ctx.font = "16px monospace";
                ctx.fillText(`State: ${gameState} (${difficulty})`, 20, 30);
                ctx.fillText(`Persona: ${persona}`, 20, 50);
                ctx.fillText(`Health: ${drone.health.toFixed(1)} / ${drone.maxHealth}`, 20, 70);
                ctx.fillText(`Fuel: ${drone.fuel.toFixed(0)}`, 20, 90);
                ctx.fillText(`Params: Launch=${hasLaunchedRef.current} Edit=${isLayoutEditing}`, 20, 110);

                const pressed = Object.entries(keysPressed.current)
                    .filter(([k, v]) => v)
                    .map(([k]) => k).join(', ');
                ctx.fillText(`Keys: ${pressed}`, 20, 130);
                // Telemetry
                ctx.fillStyle = "white";
                ctx.fillText(`Telemetry: dt=${dt.toFixed(3)} hitStop=${hitStopRef.current.toFixed(2)}`, 20, 170);
                const cond = (gameState === GameState.PLAYING || gameState === GameState.TUTORIAL) && drone.health > 0;
                ctx.fillText(`Loop Cond: ${cond} (H:${drone.health > 0})`, 20, 190);

                // Draw "PRESS R TO RESET" hint
                ctx.fillStyle = "yellow";
                ctx.fillText("Press R to Soft Reset", 20, 215);
                ctx.restore();
            }

            // --- RENDER DAMAGE FLASH OVERLAY ---
            if (damageFlashRef.current > 0) {
                ctx.fillStyle = `rgba(255, 0, 0, ${damageFlashRef.current * 0.3})`;
                ctx.fillRect(0, 0, width, height);

                // Red border/vignette
                const grad = ctx.createRadialGradient(width / 2, height / 2, height / 2, width / 2, height / 2, width);
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(1, `rgba(255, 0, 0, ${damageFlashRef.current * 0.5})`);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width, height);
            }

            // --- HIGH SPEED LIGHTING OVERLAY ---
            if (isHighSpeedRef.current) {
                const edgeColor = persona === Persona.EVIL ? [239, 68, 68] : [6, 182, 212]; // red vs cyan
                const pulseAlpha = 0.12 + Math.sin(time * 0.003) * 0.05; // subtle pulse

                // 1. Edge vignette glow
                const vGrad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.25, width / 2, height / 2, Math.max(width, height) * 0.7);
                vGrad.addColorStop(0, 'transparent');
                vGrad.addColorStop(0.7, `rgba(${edgeColor[0]}, ${edgeColor[1]}, ${edgeColor[2]}, ${pulseAlpha * 0.3})`);
                vGrad.addColorStop(1, `rgba(${edgeColor[0]}, ${edgeColor[1]}, ${edgeColor[2]}, ${pulseAlpha})`);
                ctx.fillStyle = vGrad;
                ctx.fillRect(0, 0, width, height);

                // 2. Top/bottom light bands (speed horizon lines)
                const bandAlpha = 0.04 + Math.sin(time * 0.005) * 0.02;
                const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.15);
                topGrad.addColorStop(0, `rgba(255, 255, 255, ${bandAlpha})`);
                topGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = topGrad;
                ctx.fillRect(0, 0, width, height * 0.15);

                const botGrad = ctx.createLinearGradient(0, height * 0.85, 0, height);
                botGrad.addColorStop(0, 'transparent');
                botGrad.addColorStop(1, `rgba(255, 255, 255, ${bandAlpha})`);
                ctx.fillStyle = botGrad;
                ctx.fillRect(0, height * 0.85, width, height * 0.15);


            }

            // --- ROOM LEADERBOARD ---
            if (multiplayer?.isActive && gameState === GameState.PLAYING) {
                const boardX = 20;
                const boardY = isMobileMode ? 140 : 80;

                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(boardX, boardY, 200, 150);

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px VT323';
                ctx.fillText("LIVE RANKING", boardX + 10, boardY + 20);

                const myId = multiplayer.manager?.myId || 'YOU';
                const allPlayers: any[] = Array.from(multiplayer.remotePlayers.values())
                    .filter((p: any) => p.id !== myId); // Double check filter
                allPlayers.push({ id: myId, pos: drone.pos, health: drone.health });

                allPlayers.sort((a: any, b: any) => b.pos.x - a.pos.x);

                allPlayers.slice(0, 5).forEach((p: any, i) => {
                    const isMe = p.id === (multiplayer.manager?.myId || 'YOU') || p.id === 'YOU';
                    const y = boardY + 45 + (i * 20);
                    ctx.fillStyle = isMe ? '#facc15' : '#fff';
                    ctx.fillText(`#${i + 1} ${p.id.slice(-4)}`, boardX + 10, y);
                    ctx.textAlign = 'right';
                    ctx.fillText(`${Math.floor(p.pos.x / 10)}m`, boardX + 190, y);
                    ctx.textAlign = 'left';
                });
                ctx.restore();
            }

            // --- MINIMAP RENDERING ---
            if (gameState === GameState.PLAYING) {
                const mmW = isMobileMode ? 200 : 240;
                const mmH = isMobileMode ? 60 : 80;
                // Position Top Right (Moved down on mobile to avoid overlapping with Vedal's long messages)
                const mmX = width - mmW - 20;
                const mmY = isMobileMode ? 180 : 150;
                const mmScale = 0.05; // 1000 pixels world = 50 pixels minimap

                ctx.save();
                // Draw BG
                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; ctx.fillRect(mmX, mmY, mmW, mmH);
                ctx.strokeStyle = '#38bdf8'; // Cyan border
                ctx.lineWidth = 2;
                ctx.strokeRect(mmX, mmY, mmW, mmH);

                // Clip to minimap area
                ctx.beginPath(); ctx.rect(mmX, mmY, mmW, mmH); ctx.clip();

                const mapWorldToMM = (wx: number, wy: number) => {
                    // Center X on drone
                    const dx = wx - drone.pos.x;
                    const x = mmX + mmW / 2 + dx * mmScale;
                    // Center Y roughly around typical flight path (500)
                    const y = mmY + mmH / 2 + (wy - 500) * mmScale;
                    return { x, y };
                };

                // Draw Walls on Minimap
                // Optimization: only check walls somewhat near
                levelData.walls.forEach(w => {
                    // Simple cull
                    if (Math.abs(w.x - drone.pos.x) * mmScale > mmW) return;

                    const p = mapWorldToMM(w.x, w.y);
                    ctx.fillStyle = w.type === 'checkpoint' ? '#22c55e' : (w.type === 'hazard' ? '#ef4444' : '#64748b');
                    ctx.fillRect(p.x, p.y, Math.max(2, w.w * mmScale), Math.max(2, w.h * mmScale));
                });

                // Draw Train
                if (Math.abs(train.x - drone.pos.x) * mmScale < mmW) {
                    const tp = mapWorldToMM(train.x, train.y);
                    ctx.fillStyle = '#8b5cf6';
                    ctx.fillRect(tp.x, tp.y, Math.max(4, train.w * mmScale), Math.max(4, train.h * mmScale));
                }

                // Draw Urgent Orders
                levelData.urgentOrders.forEach(o => {
                    if (Math.abs(o.x - drone.pos.x) * mmScale < mmW && !o.collected) {
                        const op = mapWorldToMM(o.x, o.y);
                        ctx.fillStyle = '#a855f7';
                        ctx.fillRect(op.x - 2, op.y - 2, 4, 4);
                    }
                });

                // Draw Drone
                const dp = mapWorldToMM(drone.pos.x, drone.pos.y);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dp.x, dp.y, 3, 0, Math.PI * 2); ctx.fill();

                // Draw Remote Players on Minimap
                if (multiplayer?.isActive) {
                    multiplayer.remotePlayers.forEach(p => {
                        const rdp = mapWorldToMM(p.pos.x, p.pos.y);
                        ctx.fillStyle = p.persona === Persona.EVIL ? '#ef4444' : '#f472b6';
                        ctx.beginPath(); ctx.arc(rdp.x, rdp.y, 2, 0, Math.PI * 2); ctx.fill();
                    });
                }

                ctx.restore();
            }

            // --- RENDER CUSTOM CROSSHAIR (EASY MODE) ---
            if (difficulty === 'EASY' && !isMobileMode && gameState === GameState.PLAYING) {
                const mx = mousePosRef.current.x;
                const my = mousePosRef.current.y;
                const drone = droneRef.current;
                const isThrusting = drone.thrustPower > 0;

                ctx.save();
                ctx.translate(mx, my);

                // Pulsing effect based on thrust
                const scale = 1 + (isThrusting ? Math.sin(Date.now() / 50) * 0.1 : 0);
                ctx.scale(scale, scale);

                const color = persona === Persona.EVIL ? '#ef4444' : '#06b6d4';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;

                // Outer circle sectors
                ctx.beginPath();
                ctx.arc(0, 0, 15, -Math.PI / 4, Math.PI / 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(0, 0, 15, Math.PI * 3 / 4, Math.PI * 5 / 4);
                ctx.stroke();

                // Inner cross
                ctx.beginPath();
                ctx.moveTo(-5, 0); ctx.lineTo(-2, 0);
                ctx.moveTo(5, 0); ctx.lineTo(2, 0);
                ctx.moveTo(0, -5); ctx.lineTo(0, -2);
                ctx.moveTo(0, 5); ctx.lineTo(0, 2);
                ctx.stroke();

                // Small dot
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
            // -------------------------

            // --- VERSION STRING ---
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.font = "10px monospace";
            ctx.textAlign = "left";
            ctx.fillText("Alpha-v1.0", 10, height - 10);
            ctx.restore();

            // --- RENDER VISUAL OVERLAYS SYNC ---

            // 1. Sync Local Drone
            if (droneOverlayRef.current) {
                // Determine visibility (hide if dead)
                if (drone.health <= 0) {
                    droneOverlayRef.current.style.display = 'none';
                } else {
                    droneOverlayRef.current.style.display = 'block';
                    let screenX = drone.pos.x + cameraRef.current.x;
                    let screenY = drone.pos.y + cameraRef.current.y;

                    // Apply same zoom as canvas so overlay aligns with canvas-drawn content (trails etc.)
                    if (currentZoom !== 1.0) {
                        screenX = (screenX - width / 2) * currentZoom + width / 2;
                        screenY = (screenY - height / 2) * currentZoom + height / 2;
                    }
                    const overlayScale = 0.3 * currentZoom;
                    droneOverlayRef.current.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%) rotate(${drone.angle}rad) scale(${overlayScale})`;

                    // Sync Thrust (CSS Var)
                    droneOverlayRef.current.style.setProperty('--thrust-scale', drone.thrustPower.toString());

                    // Sync Eye Tracking (Pupils follow velocity in body-local space)
                    const vx = drone.vel.x;
                    const vy = drone.vel.y;
                    const speed = Math.sqrt(vx * vx + vy * vy);
                    if (speed > 0.5) {
                        const cosA = Math.cos(-drone.angle);
                        const sinA = Math.sin(-drone.angle);
                        const localVx = vx * cosA - vy * sinA;
                        const localVy = vx * sinA + vy * cosA;
                        const maxOff = 2.5;
                        const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
                        droneOverlayRef.current.style.setProperty('--pupil-x', clamp(localVx * 0.015, maxOff) + 'px');
                        droneOverlayRef.current.style.setProperty('--pupil-y', clamp(localVy * 0.015, maxOff) + 'px');
                    } else {
                        droneOverlayRef.current.style.setProperty('--pupil-x', '0px');
                        droneOverlayRef.current.style.setProperty('--pupil-y', '0px');
                    }

                    // Sync React State (Debounced check)
                    const newIsInvincible = drone.invincibleTimer > 0;
                    const newIsGodMode = drone.isGodMode;
                    const newIsBursting = isHighSpeedRef.current;

                    if (newIsInvincible !== lastDroneVisualState.current.isInvincible ||
                        newIsGodMode !== lastDroneVisualState.current.isGodMode ||
                        newIsBursting !== lastDroneVisualState.current.isBursting) {
                        const newState = { isInvincible: newIsInvincible, isGodMode: newIsGodMode, isBursting: newIsBursting };
                        lastDroneVisualState.current = newState;
                        setDroneVisualState(newState);
                    }
                }
            }

            // 2. Sync Remote Drones
            if (multiplayer?.isActive && multiplayer.remotePlayers) {
                multiplayer.remotePlayers.forEach(p => {
                    const el = remoteDroneOverlaysRef.current.get(p.id);
                    if (el) {
                        if (!p.pos || p.health <= 0) {
                            el.style.display = 'none';
                        } else {
                            el.style.display = 'block';
                            let screenX = p.pos.x + cameraRef.current.x;
                            let screenY = p.pos.y + cameraRef.current.y;
                            if (currentZoom !== 1.0) {
                                screenX = (screenX - width / 2) * currentZoom + width / 2;
                                screenY = (screenY - height / 2) * currentZoom + height / 2;
                            }
                            const overlayScale = 0.3 * currentZoom;
                            el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -50%) rotate(${p.angle || 0}rad) scale(${overlayScale})`;
                            el.style.setProperty('--thrust-scale', (p.thrustPower || 0).toString());
                        }
                    }
                });
            }

            // 3. Apply Screenspace Filters (zoom is now unified in ctx.scale, no separate CSS scale)
            if (canvasRef.current) {
                if (isHighSpeedRef.current) {
                    canvasRef.current.style.filter = 'brightness(1.08) contrast(1.1) saturate(1.3)';
                } else {
                    canvasRef.current.style.filter = 'none';
                }
                canvasRef.current.style.transition = 'filter 0.5s ease';
            }

            requestRef.current = requestAnimationFrame(loop);
        };

        requestRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [gameState, persona, upgrades, onCrash, setFaceStatus, setVedalMessage, lastCheckpoint, setLastCheckpoint, difficulty, equippedItem, isMobileMode, respawnToken, onGrantRandomUpgrade, setUrgentOrderProgress, isLayoutEditing]);

    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="relative w-full h-full bg-slate-900 overflow-hidden">
            <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

            {/* High-Fidelity Drone Overlay */}
            {gameState !== GameState.MENU && (
                <div
                    ref={droneOverlayRef}
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    style={{ willChange: 'transform' }}
                >
                    <DroneView
                        color={persona === Persona.EVIL ? '#ef4444' : '#f472b6'}
                        persona={persona}
                        isMobile={isMobileMode}
                        isInvincible={droneVisualState.isInvincible}
                        isGodMode={droneVisualState.isGodMode}
                        isBursting={droneVisualState.isBursting}
                        equippedItem={equippedItem}
                        forceThrustVisual={true} // Controlled via CSS var
                        fixedSize={true}
                    />
                </div>
            )}

            {/* Remote Players Overlays */}
            {multiplayer?.isActive && Array.from(multiplayer.remotePlayers.values()).map((p: any) => (
                <div
                    key={p.id}
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    ref={el => {
                        if (el) remoteDroneOverlaysRef.current.set(p.id, el);
                        else remoteDroneOverlaysRef.current.delete(p.id);
                    }}
                    style={{ willChange: 'transform' }}
                >
                    <DroneView
                        color={p.persona === Persona.EVIL ? '#ef4444' : '#f472b6'}
                        persona={p.persona}
                        isMobile={isMobileMode}
                        health={p.health}
                        isDead={p.health <= 0}
                        forceThrustVisual={true}
                        fixedSize={true}
                    />
                </div>
            ))}
        </div>
    );
};
