
import { Peer, DataConnection } from 'peerjs';

export interface RemotePlayer {
    id: string;
    pos: { x: number, y: number };
    angle: number;
    health: number;
    persona: string;
    cargoPos?: { x: number, y: number };
    cargoAngle?: number;
    thrustPower?: number;
    // [SPECTATOR SYNC] Added stats for UI
    fuel?: number;
    hpPercent?: number; // Added for correct UI bar display
    cargoHealth?: number;
    scoreDistance?: number;
    distToNext?: number;
    lastUpdate: number;
    // [插值優化] 用於平滑移動
    targetPos?: { x: number, y: number };
    targetAngle?: number;
    targetCargoPos?: { x: number, y: number };
    targetCargoAngle?: number;
}

export interface MultiplayerState {
    peerId: string | null;
    isHost: boolean;
    connections: DataConnection[];
    players: Map<string, RemotePlayer>;
    roomSeed: string | null;
}

export type MultiplayerEvent =
    | { type: 'CONNECTED'; peerId: string }
    | { type: 'PLAYER_JOINED'; id: string }
    | { type: 'PLAYER_LEFT'; id: string }
    | { type: 'DATA'; id: string, data: any }
    | { type: 'ERROR'; message: string };

export class MultiplayerManager {
    private peer: Peer | null = null;
    private connections: Map<string, DataConnection> = new Map();
    private onEvent: (event: MultiplayerEvent) => void;

    public isHost: boolean = false;
    public myId: string | null = null;
    public myName: string = "Neuro";
    public pendingRequests: { id: string, name: string, conn: DataConnection }[] = [];
    public autoJoin: boolean = false;
    private approvedPlayerNames: Map<string, string> = new Map();

    // Heartbeat Interval
    private hbInterval: any = null;
    public roomName: string = "Neuro's Room";
    public roomSeed: string | null = null;

    static async getRooms(): Promise<any[]> {
        try {
            const res = await fetch('api/rooms');
            if (res.ok) return await res.json();
        } catch (e) {
            console.error("Failed to fetch rooms", e);
        }
        return [];
    }

    constructor(onEvent: (event: MultiplayerEvent) => void) {
        this.onEvent = onEvent;
    }

    public init() {
        const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
        const peerId = `NEURO-${randomId}`;
        console.log(`[Multiplayer] Initializing as ${peerId}...`);

        // Debug Level 3: Prints all errors and warnings + signaling msgs
        this.peer = new Peer(peerId, {
            debug: 3,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('[Multiplayer] Peer connected to signaling server. ID:', id);
            this.myId = id;
            this.onEvent({ type: 'CONNECTED', peerId: id });
        });

        this.peer.on('connection', (conn) => {
            console.log(`[Multiplayer] Inbound P2P connection from: ${conn.peer}`);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('[Multiplayer] PeerJS error:', err.type, err);
            let msg = `PeerJS Error: ${err.type} `;
            if (err.type === 'browser-incompatible') msg = "Browser doesn't support WebRTC!||瀏覽器不支援 WebRTC！";
            else if (err.type === 'peer-unavailable') msg = "Target player not found. Check ID.||找不到目標玩家。請檢查 ID 是否正確。";
            else if (err.type === 'network') msg = "Network error. Check Firewall/VPN.||網路錯誤。請檢查防火牆或 VPN 是否關閉。";

            this.onEvent({ type: 'ERROR', message: msg });
        });

        this.peer.on('disconnected', () => {
            console.warn('[Multiplayer] Disconnected from signaling server. Attempting reconnect...');
            this.peer?.reconnect();
        });
    }

    public host(name: string = "Neuro's Room") {
        console.log('Setting mode to HOST');
        this.isHost = true;
        this.roomName = name;

        // Start Heartbeat
        this.startHeartbeat();
    }

    private startHeartbeat() {
        if (this.hbInterval) clearInterval(this.hbInterval);
        const sendHB = () => {
            if (!this.myId) return;
            const payload = {
                id: this.myId,
                name: this.roomName,
                players: this.connections.size + 1,
                maxPlayers: 8
            };
            fetch('api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error("Heartbeat failed", e));
        };
        this.hbInterval = setInterval(sendHB, 5000);
        sendHB();
    }

    public join(targetId: string, playerName: string) {
        if (!this.peer) {
            console.error('Cannot join: Peer not initialized');
            return;
        }
        console.log('Attempting to join host:', targetId);
        this.isHost = false;

        // Stop heartbeat if running
        if (this.hbInterval) clearInterval(this.hbInterval);

        const conn = this.peer.connect(targetId, {
            reliable: true
        });

        conn.on('error', (err) => {
            console.error('Connection Error with', targetId, ':', err);
        });

        // Initial Handshake: Send JOIN_REQUEST instead of assuming joined
        conn.on('open', () => {
            console.log('Connected to host, sending JOIN_REQUEST...');
            conn.send({ type: 'JOIN_REQUEST', name: playerName });
        });

        this.handleConnection(conn);
    }

    public approveJoin(peerId: string, seed?: string) {
        const reqIndex = this.pendingRequests.findIndex(r => r.id === peerId);
        if (reqIndex !== -1) {
            const req = this.pendingRequests[reqIndex];
            console.log('Approving join for:', peerId);

            // Add to active connections
            this.connections.set(req.id, req.conn);
            this.approvedPlayerNames.set(req.id, req.name);
            this.onEvent({ type: 'PLAYER_JOINED', id: req.id });

            // Send Approval packet
            req.conn.send({ type: 'JOIN_APPROVED' });

            // Sync Seed immediately if provided
            if (seed) {
                req.conn.send({ type: 'SYNC_SEED', seed });
                this.roomSeed = seed;
            }

            this.pendingRequests.splice(reqIndex, 1);
            this.broadcastRoomSync();
        }
    }

    public rejectJoin(peerId: string) {
        const reqIndex = this.pendingRequests.findIndex(r => r.id === peerId);
        if (reqIndex !== -1) {
            const req = this.pendingRequests[reqIndex];
            console.log('Rejecting join for:', peerId);
            req.conn.send({ type: 'JOIN_REJECTED' });
            setTimeout(() => req.conn.close(), 500); // Give time to receive msg
            this.pendingRequests.splice(reqIndex, 1);
        }
    }

    public kick(peerId: string) {
        const conn = this.connections.get(peerId);
        if (conn) {
            conn.send({ type: 'KICKED' });
            setTimeout(() => conn.close(), 500);
            this.connections.delete(peerId);
            this.onEvent({ type: 'PLAYER_LEFT', id: peerId });
        }
    }

    private handleConnection(conn: DataConnection) {
        console.log('Handling connection for peer:', conn.peer);

        // We delay adding to 'connections' map until Approved if we are Host

        conn.on('open', () => {
            console.log('Connection established (OPEN) with:', conn.peer);
            // If we are joining (not host), we wait for APPROVED
            if (!this.isHost) {
                // Do nothing, wait for data
            }
        });

        conn.on('data', (data: any) => {
            // Host logic handling JOIN_REQUEST
            if (this.isHost && data.type === 'JOIN_REQUEST') {
                if (this.autoJoin) {
                    this.connections.set(conn.peer, conn);
                    this.approvedPlayerNames.set(conn.peer, data.name || 'Unknown');
                    this.onEvent({ type: 'PLAYER_JOINED', id: conn.peer });
                    conn.send({ type: 'JOIN_APPROVED' });
                    // Fix: Sync seed on auto-join
                    if (this.roomSeed) {
                        conn.send({ type: 'SYNC_SEED', seed: this.roomSeed });
                    }
                    this.broadcastRoomSync();
                } else {
                    // Start pending
                    this.pendingRequests.push({ id: conn.peer, name: data.name || 'Unknown', conn });
                    // Notify UI to show approval dialog?
                    // We can reuse 'DATA' event or add a new one, but let's stick to existing simple event structure for now
                    // Actually we need a way to tell App.tsx about pending requests.
                    // Let's emit a special DATA packet for local use? Or expand event types.
                    // Expanding event types is cleaner but requires modifying interface.
                    // For now, let's just expose pendingRequests public array and maybe trigger a dummy update or callback?
                    // Let's emit a custom event.
                    this.onEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'PENDING_REQUESTS_UPDATE' } });
                }
                return;
            }

            if (!this.isHost) {
                if (data.type === 'JOIN_APPROVED') {
                    console.log('Join APPROVED by host!');
                    this.connections.set(conn.peer, conn);
                    this.onEvent({ type: 'PLAYER_JOINED', id: conn.peer }); // Self joined essentially
                } else if (data.type === 'JOIN_REJECTED') {
                    console.log('Join REJECTED by host.');
                    this.onEvent({ type: 'ERROR', message: 'Join Request Rejected by Host.' });
                    conn.close();
                } else if (data.type === 'KICKED') {
                    console.log('You have been KICKED.');
                    this.onEvent({ type: 'ERROR', message: 'You have been kicked from the room.' });
                    conn.close();
                }
            }

            this.onEvent({ type: 'DATA', id: conn.peer, data });
        });

        conn.on('close', () => {
            // Remove from pending if there
            const idx = this.pendingRequests.findIndex(r => r.id === conn.peer);
            if (idx !== -1) {
                this.pendingRequests.splice(idx, 1);
                this.onEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'PENDING_REQUESTS_UPDATE' } });
            }

            console.log('Connection CLOSED with:', conn.peer);
            this.connections.delete(conn.peer);
            this.approvedPlayerNames.delete(conn.peer);
            this.onEvent({ type: 'PLAYER_LEFT', id: conn.peer });
            if (this.isHost) this.broadcastRoomSync();
        });
    }

    public broadcastRoomSync() {
        if (!this.isHost) return;
        const participants = Array.from(this.connections.keys()).map(id => ({
            id,
            name: this.approvedPlayerNames.get(id) || 'Unknown'
        }));
        // Include self (host)
        participants.push({ id: this.myId || 'HOST', name: this.myName });

        this.broadcast({
            type: 'ROOM_SYNC',
            participants
        });
        // Also notify local UI
        this.onEvent({ type: 'DATA', id: 'SYSTEM', data: { type: 'ROOM_SYNC', participants } });
    }

    public broadcast(data: any) {
        if (data.type === 'SYNC_SEED') {
            this.roomSeed = data.seed;
        }
        this.connections.forEach(conn => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    public sendTo(targetId: string, data: any) {
        const conn = this.connections.get(targetId);
        if (conn && conn.open) {
            conn.send(data);
        }
    }

    public disconnect() {
        this.connections.forEach(conn => conn.close());
        this.connections.clear();
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
    }
}
