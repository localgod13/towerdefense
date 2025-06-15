import { Peer } from 'peerjs';

interface Player {
    id: string;
    name: string;
    shipType: string;
}

export class NetworkManager {
    private static instance: NetworkManager;
    private peer: Peer | null = null;
    private connection: any = null;
    private statusCallback: ((status: string) => void) | null = null;
    private playersUpdateCallback: ((players: Player[]) => void) | null = null;
    private gameStartCallback: ((players: Player[]) => void) | null = null;
    private isHost: boolean = false;
    private players: Player[] = [];
    private playerName: string = '';
    private onConnectedCallback: (() => void) | null = null;
    private connectionId: string | null = null;
    private remoteUpdateCallback: ((x: number, y: number, name: string, shipType: string, angle: number) => void) | null = null;
    private remoteBulletCallback: ((bullet: { x: number, y: number, vx: number, vy: number, shipType: string }) => void) | null = null;
    private towerPlacementCallback: ((tower: { id: string, x: number, y: number, type: 'basic' | 'sniper' | 'splash' }) => void) | null = null;
    private enemySyncCallback: ((enemies: { id: string, type: string, x: number, y: number, health: number, pathProgress: number }[]) => void) | null = null;
    private roundStartCallback: (() => void) | null = null;
    private onRoomCode: ((code: string) => void) | null = null;
    private playerShipType: string = 'ship1';
    private remotePlayerShipType: string = 'ship1';
    private onRemotePlayerUpdateCallback: ((x: number, y: number, name: string, shipType: string, angle: number) => void) | null = null;
    private isConnected: boolean = false;
    private messageQueue: any[] = [];

    private constructor() {}

    static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    getConnectionId(): string | null {
        return this.connectionId;
    }

    onStatusUpdate(callback: (status: string) => void) {
        this.statusCallback = callback;
    }

    onPlayersUpdate(callback: (players: Player[]) => void) {
        this.playersUpdateCallback = callback;
    }

    onGameStart(callback: (players: Player[]) => void) {
        this.gameStartCallback = callback;
    }

    onConnected(callback: () => void) {
        this.onConnectedCallback = callback;
    }

    onTowerPlacement(callback: (tower: { id: string, x: number, y: number, type: 'basic' | 'sniper' | 'splash' }) => void) {
        this.towerPlacementCallback = callback;
    }

    onEnemySync(callback: (enemies: { id: string, type: string, x: number, y: number, health: number, pathProgress: number }[]) => void) {
        this.enemySyncCallback = callback;
    }

    onRoundStart(callback: () => void) {
        this.roundStartCallback = callback;
    }

    private updateStatus(status: string) {
        if (this.statusCallback) {
            this.statusCallback(status);
        }
    }

    private updatePlayers() {
        if (this.playersUpdateCallback) {
            this.playersUpdateCallback(this.players);
        }
    }

    public initialize(isHost: boolean, playerName: string, hostId?: string, onRoomCode?: (code: string) => void) {
        this.isHost = isHost;
        this.playerName = playerName;
        this.onRoomCode = onRoomCode || null;

        const config = {
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            debug: 3,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        };

        if (isHost) {
            this.peer = new Peer(config);
            this.peer.on('open', (id) => {
                if (this.onRoomCode) {
                    this.onRoomCode(id);
                }
                this.players = [{ id: 'host', name: playerName, shipType: this.playerShipType }];
                this.updatePlayers();
            });
        } else if (hostId) {
            this.peer = new Peer(config);
            this.peer.on('open', () => {
                if (this.peer) {
                    this.connection = this.peer.connect(hostId);
                    this.setupConnection();
                }
            });
        }

        if (this.peer) {
            this.peer.on('connection', (conn) => {
                this.connection = conn;
                this.setupConnection();
                if (this.isHost) {
                    this.connection.send({
                        type: 'players_update',
                        players: this.players
                    });
                }
            });

            this.peer.on('error', (err) => {
                console.error('PeerJS Error:', err);
                this.updateStatus(`Error: ${err.message}`);
            });

            this.peer.on('disconnected', () => {
                console.log('Disconnected from PeerJS server');
                this.updateStatus('Disconnected from server');
            });

            this.peer.on('close', () => {
                console.log('Connection to PeerJS server closed');
                this.updateStatus('Connection closed');
            });
        }
    }

    private setupClient(hostId: string) {
        this.updateStatus('Connecting to host...');
        this.connection = this.peer!.connect(hostId);
        this.setupConnection();
    }

    private setupConnection() {
        if (!this.connection) return;

        this.connection.on('open', () => {
            if (!this.connection) return;
            console.log('Connection opened with peer:', this.connection.peer);
            this.connectionId = this.connection.peer;
            this.isConnected = true;
            this.updateStatus('Connected to host');
            
            // Process any queued messages
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                this.connection.send(message);
            }

            if (this.onConnectedCallback) {
                this.onConnectedCallback();
            }
            // Send player info to host
            this.connection.send({
                type: 'player_join',
                name: this.playerName,
                shipType: this.playerShipType
            });
        });

        this.connection.on('data', (data: any) => {
            if (!this.connection) return;
            console.log('Received data:', data);
            if (data.type === 'player_join') {
                if (this.isHost) {
                    // Add new player to the list
                    this.players.push({ id: this.connection.peer, name: data.name, shipType: data.shipType });
                    this.updatePlayers();
                    // Send updated player list to all players
                    this.connection.send({
                        type: 'players_update',
                        players: this.players
                    });
                }
            } else if (data.type === 'position' && this.remoteUpdateCallback) {
                console.log('Received position update:', data);
                // Only update position if we have valid coordinates
                if (typeof data.x === 'number' && typeof data.y === 'number' && data.x !== 0 && data.y !== 0) {
                    this.remoteUpdateCallback(data.x, data.y, data.name, data.shipType, data.angle);
                }
            } else if (data.type === 'bullet' && this.remoteBulletCallback) {
                this.remoteBulletCallback(data);
            } else if (data.type === 'tower_placement' && this.towerPlacementCallback) {
                console.log('Received tower placement:', data.tower);
                this.towerPlacementCallback(data.tower);
            } else if (data.type === 'enemy_sync' && this.enemySyncCallback) {
                this.enemySyncCallback(data.enemies);
            } else if (data.type === 'round_start' && this.roundStartCallback) {
                this.roundStartCallback();
            } else if (data.type === 'players_update' && this.playersUpdateCallback) {
                this.playersUpdateCallback(data.players);
            } else if (data.type === 'game_start' && this.gameStartCallback) {
                this.gameStartCallback(data.players);
            }
        });

        this.connection.on('close', () => {
            this.isConnected = false;
            this.updateStatus('Connection closed');
            if (this.isHost) {
                // Remove disconnected player
                this.players = this.players.filter(p => p.id !== this.connection.peer);
                this.updatePlayers();
            }
        });
    }

    private sendMessage(message: any) {
        if (this.connection && this.isConnected) {
            this.connection.send(message);
        } else {
            // Queue the message to be sent when connection opens
            this.messageQueue.push(message);
        }
    }

    public sendPosition(x: number, y: number, name: string, shipType: string, angle: number) {
        console.log('Sending position update:', { x, y, name, shipType, angle });
        this.sendMessage({
            type: 'position',
            x,
            y,
            name,
            shipType,
            angle
        });
    }

    sendBullet(bullet: { x: number, y: number, vx: number, vy: number, shipType: string }) {
        this.sendMessage({
            type: 'bullet',
            ...bullet
        });
    }

    sendTowerPlacement(tower: { id: string, x: number, y: number, type: 'basic' | 'sniper' | 'splash' }) {
        this.sendMessage({
            type: 'tower_placement',
            tower: tower
        });
    }

    sendEnemySync(enemies: { id: string, type: string, x: number, y: number, health: number, pathProgress: number }[]) {
        this.sendMessage({
            type: 'enemy_sync',
            enemies: enemies
        });
    }

    sendRoundStart() {
        this.sendMessage({
            type: 'round_start'
        });
    }

    public sendShipUpdate(shipType: string) {
        this.sendMessage({
            type: 'ship',
            shipType: shipType
        });
    }

    startGame() {
        if (this.isHost) {
            this.sendMessage({
                type: 'game_start',
                players: this.players
            });
            if (this.gameStartCallback) {
                this.gameStartCallback(this.players);
            }
        }
    }

    onRemotePlayerUpdate(callback: (x: number, y: number, name: string, shipType: string, angle: number) => void) {
        this.remoteUpdateCallback = callback;
    }

    onRemoteBulletUpdate(callback: (bullet: { x: number, y: number, vx: number, vy: number, shipType: string }) => void) {
        this.remoteBulletCallback = callback;
    }
}

export function initNetwork(player: any) {
    const network = NetworkManager.getInstance();
    
    // Send position updates more frequently (16ms = ~60fps)
    setInterval(() => {
        network.sendPosition(player.x, player.y, player.name, player.shipType, player.angle);
    }, 16);
} 