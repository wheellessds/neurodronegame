
export enum GameState {
  LOADING,
  MENU,
  PLAYING,
  CHECKPOINT_SHOP, // Replaces LEVEL_SHOP
  SHOP,
  GAME_OVER,
  VICTORY, // Technically unreachable in endless, but kept for logic safety
  PAUSED,
  WAITING_LOBBY
}

export enum Persona {
  NEURO = 'NEURO',
  EVIL = 'EVIL'
}

export type EquipmentId = 'NONE' | 'MAGNET' | 'ARMOR' | 'ECO_CHIP';

export interface Vector2 {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface Entity {
  pos: Vector2;
  vel: Vector2;
  radius: number;
  angle: number;
  angularVel: number;
}

export interface Drone extends Entity {
  fuel: number;
  maxFuel: number;
  health: number;
  maxHealth: number;
  thrustPower: number;
  invincibleTimer: number;
  isGodMode?: boolean;
}

export interface Cargo extends Entity {
  health: number;
  maxHealth: number;
  connected: boolean;
}

export interface Coin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  value: number;
}

export type PowerUpType = 'FUEL' | 'REPAIR' | 'SHIELD';

export interface PowerUp {
  x: number;
  y: number;
  vel: Vector2;
  radius: number;
  collected: boolean;
  type: PowerUpType;
  onGround: boolean;
}

// New Entity for Time Extension / Urgent Delivery
export interface UrgentOrder {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface Train {
  x: number;
  y: number;
  speed: number;
  w: number;
  h: number;
}

export interface Tutel extends Entity {
  state: 'idle' | 'chasing' | 'attached' | 'yeeted';
  attachOffset?: Vector2;
}

export interface GasZone extends Rect {
  timer: number;
  gravityScale: number;
}

export interface LevelData {
  walls: Rect[];
  // Removed fixed start/end zones, replaced with checkpoint logic
  obstacles: Rect[];
  coins: Coin[];
  powerups: PowerUp[];
  tutels: Tutel[];
  gasZones: GasZone[];
  urgentOrders: UrgentOrder[]; // Added Urgent Orders
  train: Train;
}

export interface MoveConfig {
  speed: number;
  range: number;
  axis: 'x' | 'y';
  initialPos: number;
  offset: number;
  phase: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  type?: 'wall' | 'hazard' | 'checkpoint' | 'moving_wall'; // changed goal/shop to checkpoint
  moveConfig?: MoveConfig;
  vel?: Vector2;
}

export interface UpgradeStats {
  engineLevel: number;
  tankLevel: number;
  hullLevel: number;
  cableLevel: number;
  cargoLevel: number; // New upgrade
  money: number;
  diamonds: number;
}

export interface InputState {
  up: boolean;
  left: boolean;
  right: boolean;
  timestamp: number;
}

export interface LeaderboardEntry {
  name: string;
  distance: number;
  time: number;
  date: string;
  persona: Persona;
  difficulty: 'NORMAL' | 'EASY';
  isMobile: boolean;
  seed: string;
  trajectory?: { x: number, y: number }[];
  cargoTrajectory?: { x: number, y: number }[];
}

export interface GhostData {
  trajectory: { x: number, y: number }[];
  cargoTrajectory?: { x: number, y: number }[];
  name: string;
}

export interface KeyBindings {
  thrust: string;
  left: string;
  right: string;
  pause: string;
}

export interface MobileButtonPos {
  x: number; // Percent from edge (left/right)
  y: number; // Percent from bottom
}

export interface MobileLayout {
  thrust: MobileButtonPos;
  left: MobileButtonPos;
  right: MobileButtonPos;
  joystick: MobileButtonPos;
}

export interface ControlsConfig {
  keys: KeyBindings;
  mobile: MobileLayout;
}

export interface NeuroSettings {
  mpUpdateRate: 'low' | 'med' | 'high';
}
