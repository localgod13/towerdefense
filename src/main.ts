import './style.css'
import { Game } from './game'
import { NetworkManager, initNetwork } from './network'
import mainBackgroundUrl from './assets/images/mainback.png'
import levelBackgroundUrl from './assets/images/level1.png'
import { drawLevelBackground } from './utils'
import { drawGrid, getGridDimensions, TILE_TYPES } from './map.ts'
import { toggleGrid, isGridVisible } from './map'
import { enemyManager } from './enemies'
import { TowerManager } from './towers'
import { Player } from './players'

// Debug settings
let debugMode = false;

// Create canvas
const canvas = document.createElement('canvas')
document.body.appendChild(canvas)
const ctx = canvas.getContext('2d')!

// Game world constants
export const GAME_HEIGHT = 1080
export const GAME_WIDTH = 1920
const PLAYER_SIZE = 20

// Viewport scaling
let viewportScale = 1

// Make canvas fill the viewport while maintaining aspect ratio
function resizeCanvas() {
    // Set canvas to fill window
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
}

// Convert world coordinates to screen coordinates
function worldToScreen(x: number, y: number): { x: number, y: number } {
    return {
        x: x * viewportScale,
        y: y * viewportScale
    }
}

// Convert screen coordinates to world coordinates
function screenToWorld(x: number, y: number): { x: number, y: number } {
    return {
        x: x / viewportScale,
        y: y / viewportScale
    }
}

// Keep player within world bounds
function keepInBounds(x: number, y: number): { x: number, y: number } {
    const scale = window.innerHeight / GAME_HEIGHT
    const GAME_WIDTH = window.innerWidth / scale
    
    return {
        x: Math.max(PLAYER_SIZE/2, Math.min(x, GAME_WIDTH - PLAYER_SIZE/2)),
        y: Math.max(PLAYER_SIZE/2, Math.min(y, GAME_HEIGHT - PLAYER_SIZE/2))
    }
}

// Create setup modal
const setupModal = document.createElement('div')
setupModal.className = 'setup-modal'
setupModal.innerHTML = `
    <div class="modal-content">
        <h2>Welcome to MultiRogue</h2>
        <div class="input-group">
            <label for="playerName">Your Name:</label>
            <input type="text" id="playerName" placeholder="Enter your name">
        </div>
        <div class="connection-options">
            <button id="hostBtn" class="btn">Host Game</button>
            <div class="divider">or</div>
            <div class="join-section">
                <input type="text" id="hostId" placeholder="Enter host ID">
                <button id="joinBtn" class="btn">Join Game</button>
            </div>
        </div>
    </div>
`
document.body.appendChild(setupModal)

// Create lobby screen
const lobbyScreen = document.createElement('div')
lobbyScreen.className = 'lobby-screen'
lobbyScreen.style.display = 'none'
lobbyScreen.innerHTML = `
    <div class="lobby-content">
        <h2>Game Lobby</h2>
        <div class="room-info">
            <div class="room-code">
                <label>Room Code:</label>
                <div class="code-display">
                    <span id="roomCode">Waiting...</span>
                    <button id="copyCode" class="btn small">Copy</button>
                </div>
            </div>
        </div>
        <div class="ship-selection">
            <h3>Choose Your Ship</h3>
            <div class="ship-options">
                <button class="ship-btn" data-ship="ship1">
                    <img src="src/assets/images/ship1.png" alt="Ship 1">
                    <span>Ship 1</span>
                </button>
                <button class="ship-btn" data-ship="ship2">
                    <img src="src/assets/images/ship2.png" alt="Ship 2">
                    <span>Ship 2</span>
                </button>
                <button class="ship-btn" data-ship="ship3">
                    <img src="src/assets/images/ship3.png" alt="Ship 3">
                    <span>Ship 3</span>
                </button>
            </div>
        </div>
        <div class="players-list">
            <h3>Players</h3>
            <ul id="playersList"></ul>
        </div>
        <div class="lobby-actions">
            <button id="startGameBtn" class="btn primary" style="display: none;">Start Game</button>
        </div>
    </div>
`
document.body.appendChild(lobbyScreen)

// Create status div
const statusDiv = document.createElement('div')
statusDiv.style.position = 'fixed'
statusDiv.style.top = '10px'
statusDiv.style.left = '10px'
statusDiv.style.color = 'white'
statusDiv.style.fontFamily = 'Arial'
statusDiv.style.padding = '10px'
statusDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
statusDiv.style.borderRadius = '5px'
document.body.appendChild(statusDiv)

// Game state
let gameStarted = false;
let isSinglePlayer = false;
let currentScreen: 'main' | 'lobby' | 'game' | 'gameOver' = 'main';
let player = { 
    x: 0, 
    y: 0, 
    vx: 0,
    vy: 0,
    angle: 0, // rotation in radians
    shipType: 'ship1', 
    name: '' 
}
let remotePlayerInstance: Player | null = null;
let selectedShip = 'ship1'
let targetRemoteX = 0
let targetRemoteY = 0
let mainBackgroundImage: HTMLImageElement | null = null
let levelBackgroundImage: HTMLImageElement | null = null
let imagesLoaded = false
let mouseX = 0;
let mouseY = 0;

// Tower UI state
let isTowerMenuOpen = false;
let playerCurrency = 500; // Starting currency
let hoveredTowerType: 'basic' | 'sniper' | 'splash' | null = null;

// Create tower menu button
const towerMenuBtn = document.createElement('button');
towerMenuBtn.className = 'tower-menu-btn';
towerMenuBtn.innerHTML = `
    <span class="tower-icon">🏰</span>
    <span class="tower-text">Towers</span>
`;
towerMenuBtn.style.display = 'none';
document.body.appendChild(towerMenuBtn);

// Create tower menu panel
const towerMenuPanel = document.createElement('div');
towerMenuPanel.className = 'tower-menu-panel';
towerMenuPanel.style.display = 'none';
towerMenuPanel.innerHTML = `
    <div class="tower-menu-header">
        <h3>Tower Selection</h3>
        <div class="currency-display">
            <span class="currency-icon">💰</span>
            <span class="currency-amount">${playerCurrency}</span>
        </div>
    </div>
    <div class="tower-list">
        <div class="tower-item" data-type="basic">
            <div class="tower-icon" style="background-color: #4CAF50;">B</div>
            <div class="tower-info">
                <h4>Basic Tower</h4>
                <p>Cost: 100</p>
                <p>Damage: 10</p>
                <p>Range: 150</p>
            </div>
        </div>
        <div class="tower-item" data-type="sniper">
            <div class="tower-icon" style="background-color: #2196F3;">S</div>
            <div class="tower-info">
                <h4>Sniper Tower</h4>
                <p>Cost: 200</p>
                <p>Damage: 50</p>
                <p>Range: 300</p>
            </div>
        </div>
        <div class="tower-item" data-type="splash">
            <div class="tower-icon" style="background-color: #FF9800;">S</div>
            <div class="tower-info">
                <h4>Splash Tower</h4>
                <p>Cost: 150</p>
                <p>Damage: 15</p>
                <p>Range: 100</p>
            </div>
        </div>
    </div>
`;
document.body.appendChild(towerMenuPanel);

// Create a single instance of TowerManager
const towerManager = new TowerManager();

// Update tower menu event listeners
towerMenuBtn.addEventListener('click', () => {
    isTowerMenuOpen = !isTowerMenuOpen;
    towerMenuPanel.style.display = isTowerMenuOpen ? 'block' : 'none';
});

towerMenuPanel.addEventListener('mouseover', (e) => {
    const towerItem = (e.target as HTMLElement).closest('.tower-item');
    if (towerItem) {
        hoveredTowerType = towerItem.getAttribute('data-type') as 'basic' | 'sniper' | 'splash';
    }
});

towerMenuPanel.addEventListener('mouseout', () => {
    hoveredTowerType = null;
});

towerMenuPanel.addEventListener('click', (e) => {
    const towerItem = (e.target as HTMLElement).closest('.tower-item');
    if (towerItem) {
        const towerType = towerItem.getAttribute('data-type') as 'basic' | 'sniper' | 'splash';
        const cost = towerManager.getTowerCost(towerType);
        
        if (playerCurrency >= cost) {
            towerManager.startTowerPlacement(towerType);
            isTowerMenuOpen = false;
            towerMenuPanel.style.display = 'none';
        }
    }
});

// Bullet interface
interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    owner: 'local' | 'remote';
    shipType: string;
}

// Bullets array
let bullets: Bullet[] = [];

// Movement constants
const ROTATION_SPEED = 0.05    // How fast the player rotates
const THRUST = 0.15           // How much force is applied when accelerating
const FRICTION = 0.98         // How quickly the player slows down
const MAX_SPEED = 5           // Maximum movement speed
const BULLET_SPEED = 10      // Speed of bullets
const FIRE_RATE = 500       // Minimum time between shots in milliseconds

// Track last shot time
let lastShotTime = 0;
const SHOT_COOLDOWN = 300; // 300ms between shots (3.33 shots per second)

// Track key states
const keys = {
    w: false,
    a: false,
    d: false,
    ' ': false
}

// Initialize game and network
const game = Game.getInstance()
const network = NetworkManager.getInstance()

// Level to background mapping
// To add a new background, just drop the PNG in public/assets/backgrounds/ and add it here.
const levelBackgrounds: Record<number, string> = {
    1: 'level1',
    // 2: 'forest',
    // 3: 'dungeon',
    // ...
};

// Main menu/lobby background
// To change, just drop a PNG in public/assets/backgrounds/ and update this variable.
const mainMenuBackground = 'mainback';

let currentLevel = 1; // Set this to the current level as needed

// Load ship images
const shipImages: { [key: string]: HTMLImageElement } = {};
const shipImagePromises = ['ship1', 'ship2', 'ship3'].map(shipType => {
    return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = `src/assets/images/${shipType}.png`;
        img.onload = () => {
            shipImages[shipType] = img;
            resolve();
        };
    });
});

// Load background images
function loadBackgroundImages() {
    return new Promise<void>((resolve) => {
        let loadedCount = 0
        const totalImages = 2

        const onImageLoad = () => {
            loadedCount++
            console.log(`Image loaded (${loadedCount}/${totalImages})`)
            if (loadedCount === totalImages) {
                imagesLoaded = true
                console.log('All images loaded successfully')
                resolve()
            }
        }

        // Load main background
        mainBackgroundImage = new Image()
        mainBackgroundImage.onload = () => {
            console.log('Main background loaded successfully:', {
                complete: mainBackgroundImage?.complete,
                naturalWidth: mainBackgroundImage?.naturalWidth,
                naturalHeight: mainBackgroundImage?.naturalHeight,
                src: mainBackgroundImage?.src
            })
            onImageLoad()
        }
        mainBackgroundImage.onerror = (e) => {
            console.error('Error loading main background:', e)
            onImageLoad() // Still count as loaded to prevent hanging
        }
        mainBackgroundImage.src = new URL('./assets/images/mainback.png', import.meta.url).href
        console.log('Main background src set to:', mainBackgroundImage.src)
        
        // Load level background
        levelBackgroundImage = new Image()
        levelBackgroundImage.onload = () => {
            console.log('Level background loaded successfully:', {
                complete: levelBackgroundImage?.complete,
                naturalWidth: levelBackgroundImage?.naturalWidth,
                naturalHeight: levelBackgroundImage?.naturalHeight,
                src: levelBackgroundImage?.src
            })
            onImageLoad()
        }
        levelBackgroundImage.onerror = (e) => {
            console.error('Error loading level background:', e)
            onImageLoad() // Still count as loaded to prevent hanging
        }
        levelBackgroundImage.src = new URL('./assets/images/level1.png', import.meta.url).href
        console.log('Level background src set to:', levelBackgroundImage.src)
    })
}

// Initialize game and network
async function init() {
    console.log('Starting image loading...')
    await loadBackgroundImages()
    console.log('Image loading complete, starting game...')
    
    // Initialize game
    game.initialize()
    
    // Initialize network
    initNetwork(player)
    
    // Set initial screen to main menu
    currentScreen = 'main';
    
    // Hide setup modal initially
    setupModal.style.display = 'none';
    
    // Initialize player in center of screen for single player
    if (isSinglePlayer) {
        game.playerCharacter.x = canvas.width / 2;
        game.playerCharacter.y = canvas.height / 2;
        player = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: 0,
            vy: 0,
            angle: -Math.PI/2, // Point upward
            shipType: selectedShip,
            name: 'Player'
        }
    }
    
    // Start render loop
    render();
}

// Update status display
function updateStatus(message: string) {
    statusDiv.textContent = message
}

network.onStatusUpdate((status: string) => {
    updateStatus(status)
})

// Interpolation function for smooth movement
function interpolatePosition(current: number, target: number, factor: number = 0.2): number {
    return current + (target - current) * factor;
}

// Update players list
function updatePlayersList(players: { id: string, name: string, shipType: string }[]) {
    const playersList = document.getElementById('playersList')
    if (playersList) {
        playersList.innerHTML = players.map(player => `
            <li class="player-item">
                <div class="player-info">
                    <img src="src/assets/images/${player.shipType}.png" alt="${player.shipType}" class="player-ship">
                    <span class="player-name">${player.name}</span>
                </div>
                ${player.id === 'host' ? '<span class="host-badge">Host</span>' : ''}
            </li>
        `).join('')
    }
}

// Show lobby screen
function showLobby(isHost: boolean, roomCode?: string) {
    setupModal.style.display = 'none'
    lobbyScreen.style.display = 'flex'
    currentScreen = 'lobby'
    
    if (isHost) {
        document.getElementById('startGameBtn')!.style.display = 'block'
        if (roomCode) {
            document.getElementById('roomCode')!.textContent = roomCode
        }
    }

    // Set up ship selection
    const shipButtons = document.querySelectorAll('.ship-btn')
    shipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected class from all buttons
            shipButtons.forEach(b => b.classList.remove('selected'))
            // Add selected class to clicked button
            btn.classList.add('selected')
            // Update selected ship
            selectedShip = btn.getAttribute('data-ship') || 'ship1'
            // Update player ship
            player.shipType = selectedShip
            // Send ship update to other players
            network.sendShipUpdate(selectedShip)
        })
    })

    // Select default ship
    const defaultShipBtn = document.querySelector('.ship-btn[data-ship="ship1"]')
    if (defaultShipBtn) {
        defaultShipBtn.classList.add('selected')
    }

    // Update player list when players change
    network.onPlayersUpdate((players) => {
        const playerList = document.getElementById('playersList')
        if (playerList) {
            playerList.innerHTML = players.map(p => `
                <li class="player-item">
                    <div class="player-info">
                        <img src="src/assets/images/${p.shipType}.png" alt="${p.shipType}" class="player-ship">
                        <span class="player-name">${p.name}</span>
                    </div>
                    ${p.id === 'host' ? '<span class="host-badge">Host</span>' : ''}
                </li>
            `).join('')
        }
    })
}

// Start game function
function startGame(isHost: boolean, playerName: string, hostId?: string) {
    console.log('Starting game:', { isHost, playerName, hostId });
    const scale = window.innerHeight / GAME_HEIGHT
    const GAME_WIDTH = window.innerWidth / scale

    // Initialize player positions with fixed positions in world space
    if (isHost) {
        player = { 
            x: GAME_WIDTH * 0.25,
            y: GAME_HEIGHT / 2,
            vx: 0,
            vy: 0,
            angle: -Math.PI/2, // Point upward
            shipType: selectedShip, 
            name: playerName 
        }
        console.log('Host player initialized:', player);
        remotePlayerInstance = new Player('remote');
        remotePlayerInstance.updatePosition(targetRemoteX, targetRemoteY, 0);
    } else {
        player = { 
            x: GAME_WIDTH * 0.75,
            y: GAME_HEIGHT / 2,
            vx: 0,
            vy: 0,
            angle: -Math.PI/2, // Point upward
            shipType: selectedShip, 
            name: playerName 
        }
        console.log('Client player initialized:', player);
        remotePlayerInstance = new Player('remote');
        remotePlayerInstance.updatePosition(targetRemoteX, targetRemoteY, 0);
    }

    // Show tower menu button when game starts
    towerMenuBtn.style.display = 'flex';

    // Initialize network
    network.initialize(isHost, playerName, hostId, (roomCode) => {
        console.log('Room code received:', roomCode);
        showLobby(isHost, roomCode)
    })

    network.onPlayersUpdate((players) => {
        console.log('Players list updated:', players);
        updatePlayersList(players)
    })

    network.onConnected(() => {
        console.log('Network connected');
        showLobby(false)
    })

    network.onGameStart((players) => {
        console.log('Game started with players:', players);
        // Always start at level 1 when the game begins
        currentLevel = 1;
        gameStarted = true
        currentScreen = 'game'
        lobbyScreen.style.display = 'none'
        
        // Update remote player name and ship type based on the players list
        const otherPlayer = players.find(p => p.id !== (isHost ? 'host' : network.getConnectionId()))
        if (otherPlayer) {
            console.log('Found other player:', otherPlayer);
            remotePlayerInstance!.name = otherPlayer.name
            remotePlayerInstance!.updateShipType(otherPlayer.shipType)
        }

        // Set up enemy manager network sync
        enemyManager.setNetwork(network, isHost);
    })

    // Set up remote player updates
    network.onRemotePlayerUpdate((x, y, name, shipType, angle) => {
        console.log('Received remote player update:', { x, y, name, shipType, angle });
        if (gameStarted) {
            targetRemoteX = x;
            targetRemoteY = y;
            remotePlayerInstance!.name = name;
            remotePlayerInstance!.updateShipType(shipType);
            remotePlayerInstance!.updatePosition(x, y, angle);
        }
    });

    // Set up position update interval
    const positionUpdateInterval = setInterval(() => {
        if (gameStarted && !isSinglePlayer) {
            console.log('Sending position update:', player);
            network.sendPosition(player.x, player.y, player.name, player.shipType, player.angle);
        }
    }, 100);

    // Clean up interval when game ends
    window.addEventListener('beforeunload', () => {
        clearInterval(positionUpdateInterval);
    });

    // Set up remote bullet updates
    network.onRemoteBulletUpdate((bullet) => {
        bullets.push({
            x: bullet.x,
            y: bullet.y,
            vx: bullet.vx,
            vy: bullet.vy,
            color: 'red',
            owner: 'remote',
            shipType: bullet.shipType
        });
    });

    // Set up remote tower placement updates
    network.onTowerPlacement((tower) => {
        if (gameStarted) {
            towerManager.addRemoteTower(tower);
        }
    });

    // Set up enemy sync
    network.onEnemySync((enemies) => {
        if (gameStarted) {
            enemyManager.syncEnemies(enemies);
        }
    });

    // Set up round start sync
    network.onRoundStart(() => {
        if (gameStarted) {
            enemyManager.startRound();
        }
    });

    initNetwork(player)
}

// Setup event listeners
document.getElementById('hostBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName') as HTMLInputElement
    if (nameInput.value.trim()) {
        startGame(true, nameInput.value.trim())
    }
})

document.getElementById('joinBtn')?.addEventListener('click', () => {
    const nameInput = document.getElementById('playerName') as HTMLInputElement
    const hostIdInput = document.getElementById('hostId') as HTMLInputElement
    if (nameInput.value.trim() && hostIdInput.value.trim()) {
        startGame(false, nameInput.value.trim(), hostIdInput.value.trim())
    }
})

document.getElementById('startGameBtn')?.addEventListener('click', () => {
    network.startGame()
})

document.getElementById('copyCode')?.addEventListener('click', () => {
    const roomCode = document.getElementById('roomCode')?.textContent
    if (roomCode) {
        navigator.clipboard.writeText(roomCode)
        const copyBtn = document.getElementById('copyCode')
        if (copyBtn) {
            copyBtn.textContent = 'Copied!'
            setTimeout(() => {
                copyBtn.textContent = 'Copy'
            }, 2000)
        }
    }
})

// Movement controls
document.addEventListener('keydown', (e) => {
    if (!gameStarted) return
    if (e.key in keys) {
        keys[e.key as keyof typeof keys] = true
    }
})

document.addEventListener('keyup', (e) => {
    if (!gameStarted) return
    if (e.key in keys) {
        keys[e.key as keyof typeof keys] = false
    }
})

// Update player movement
function updatePlayerMovement() {
    // Handle rotation
    if (keys.a) {
        player.angle -= ROTATION_SPEED
    }
    if (keys.d) {
        player.angle += ROTATION_SPEED
    }

    // Apply thrust in the direction the player is facing
    if (keys.w) {
        // Since we start at -π/2 (pointing up), we need to adjust our calculations
        player.vx += Math.sin(player.angle) * THRUST  // Use sin for x
        player.vy += -Math.cos(player.angle) * THRUST // Use -cos for y
    }

    // Handle shooting
    if (keys[' ']) {
        shoot();
    }

    // Apply friction
    player.vx *= FRICTION
    player.vy *= FRICTION

    // Limit maximum speed
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy)
    if (speed > MAX_SPEED) {
        const ratio = MAX_SPEED / speed
        player.vx *= ratio
        player.vy *= ratio
    }

    // Update position
    player.x += player.vx
    player.y += player.vy

    // Calculate current game width for clamping
    const scale = window.innerHeight / GAME_HEIGHT
    const GAME_WIDTH = window.innerWidth / scale

    // Apply boundary checking in world space
    const bounded = keepInBounds(player.x, player.y)
    player.x = bounded.x
    player.y = bounded.y

    // Bounce off boundaries with angle reflection
    if (player.x <= PLAYER_SIZE/2 || player.x >= GAME_WIDTH - PLAYER_SIZE/2) {
        player.vx *= -0.5
        player.angle = Math.PI - player.angle // Reflect angle
    }
    if (player.y <= PLAYER_SIZE/2 || player.y >= GAME_HEIGHT - PLAYER_SIZE/2) {
        player.vy *= -0.5
        player.angle = -player.angle // Reflect angle
    }
}

// Shoot function
function shoot() {
    if (!gameStarted) return;
    
    const currentTime = performance.now();
    if (currentTime - lastShotTime < SHOT_COOLDOWN) return;
    lastShotTime = currentTime;
    
    const bulletSpeed = 10;
    const bullet = {
        x: player.x,
        y: player.y,
        vx: Math.sin(player.angle) * bulletSpeed,  // Use sin for x like in movement
        vy: -Math.cos(player.angle) * bulletSpeed, // Use -cos for y like in movement
        color: 'white',
        owner: 'local' as const,
        shipType: player.shipType
    };
    bullets.push(bullet);
    
    // Send bullet to other player
    if (!isSinglePlayer) {
        network.sendBullet({
            x: bullet.x,
            y: bullet.y,
            vx: bullet.vx,
            vy: bullet.vy,
            shipType: bullet.shipType
        });
    }
}

// Add mouse move handler for hover effects
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const scale = window.innerHeight / GAME_HEIGHT
    mouseX = (e.clientX - rect.left) / scale
    mouseY = (e.clientY - rect.top) / scale
});

// Render game
async function render() {
    // Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    
    // Calculate scale to maintain aspect ratio
    const scale = window.innerHeight / GAME_HEIGHT;
    const GAME_WIDTH = window.innerWidth / scale;
    
    // Set transform for proper scaling
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    
    let debugBgError = '';
    let debugBgName = '';

    // Handle tower menu button visibility based on screen and game state
    if (currentScreen === 'game' && gameStarted && !enemyManager.isRoundInProgress()) {
        towerMenuBtn.style.display = 'flex';
    } else {
        towerMenuBtn.style.display = 'none';
        towerMenuPanel.style.display = 'none';
    }

    if (currentScreen === 'game') {
        // Update game state
        if (gameStarted) {
            // Update towers with current timestamp
            const currentTime = performance.now();
            towerManager.update(enemyManager.getEnemies(), currentTime);
        }

        // Draw the background for the current level
        const bgName = levelBackgrounds[currentLevel];
        debugBgName = bgName || '(none)';
        if (bgName) {
            try {
                await drawLevelBackground(ctx, bgName, GAME_WIDTH, GAME_HEIGHT);
        } catch (e) {
                debugBgError = (e instanceof Error ? e.message : String(e));
        }
    } else {
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.fillStyle = 'red';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`No background mapped for level ${currentLevel}`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
            debugBgError = `No background mapped for level ${currentLevel}`;
        }

        // Draw the game map if grid is enabled
        if (isGridVisible()) {
            drawGrid(ctx);
    }

    // Draw debug border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

        if (gameStarted || isSinglePlayer) {
        updatePlayerMovement()

            // Update and draw enemies
            enemyManager.update();
            enemyManager.draw(ctx);
            
            // Check for game over
            if (enemyManager.getLives() <= 0) {
                currentScreen = 'gameOver';
                gameStarted = false;
            }
            
            // Check for collisions with enemies
            const enemies = enemyManager.getEnemies();
            for (const enemy of enemies) {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < PLAYER_SIZE + enemy.size) {
                    // Handle collision
                    console.log('Player hit by enemy!');
                    // TODO: Add player damage handling
                }
            }

            // Draw round preparation UI if round is not active
            if (!enemyManager.isRoundInProgress()) {
                const roundConfig = enemyManager.getRoundConfig();
                
                // Draw semi-transparent overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                
                // Draw round info
                ctx.fillStyle = 'white';
                ctx.font = '32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`Round ${enemyManager.getCurrentRound()}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
                
                // Draw enemy info
                ctx.font = '24px Arial';
                ctx.fillText(`Enemies: ${roundConfig.enemyCount}`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
                ctx.fillText(`Types: ${roundConfig.enemyTypes.join(', ')}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
                
                // Draw start button
                const buttonWidth = 200;
                const buttonHeight = 50;
                const buttonX = GAME_WIDTH / 2 - buttonWidth / 2;
                const buttonY = GAME_HEIGHT / 2 + 100;
                
                // Check if mouse is over button
                const isOverButton = mouseX > buttonX && mouseX < buttonX + buttonWidth &&
                                    mouseY > buttonY && mouseY < buttonY + buttonHeight;
                
                // Draw button background
                ctx.fillStyle = isOverButton ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
                
                // Draw button border
                ctx.strokeStyle = isOverButton ? 'white' : 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
                
                // Draw button text
                ctx.fillStyle = 'white';
                ctx.font = '24px Arial';
                ctx.fillText('Start Round', GAME_WIDTH / 2, buttonY + 35);
                
                // Add click handler for start button
                canvas.addEventListener('click', (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const clickX = (e.clientX - rect.left) / scale;
                    const clickY = (e.clientY - rect.top) / scale;
                    
                    if (clickX > buttonX && clickX < buttonX + buttonWidth &&
                        clickY > buttonY && clickY < buttonY + buttonHeight) {
                        enemyManager.startRound();
                    }
                });
            }

            viewportScale = scale;

        // Set up viewport transform
        ctx.save()
        ctx.setTransform(
            viewportScale, 0,
            0, viewportScale,
            0, 0
        )

        // Draw world border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

            // Draw player
        ctx.save()
        ctx.translate(player.x, player.y)
        ctx.rotate(player.angle)
        const playerShip = shipImages[player.shipType];
        if (playerShip) {
            ctx.drawImage(playerShip, -20, -20, 40, 40);
        }
        ctx.restore()

        // Draw remote player
        if (remotePlayerInstance && remotePlayerInstance.hasValidPosition) {
            // Interpolate position
            remotePlayerInstance.x += (remotePlayerInstance.targetX - remotePlayerInstance.x) * 0.1;
            remotePlayerInstance.y += (remotePlayerInstance.targetY - remotePlayerInstance.y) * 0.1;

            ctx.save();
            ctx.translate(remotePlayerInstance.x, remotePlayerInstance.y);
            ctx.rotate(remotePlayerInstance.angle);
            const shipImg = shipImages[remotePlayerInstance.shipType];
            if (shipImg) {
                ctx.drawImage(shipImg, -20, -20, 40, 40);
            }
            ctx.restore();
        }
        
        // Update and draw bullets
        bullets = bullets.filter(bullet => {
            // Move bullet
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;

            // Check if bullet is out of bounds
            if (bullet.x < 0 || bullet.x > GAME_WIDTH || bullet.y < 0 || bullet.y > GAME_HEIGHT) {
                return false;
            }

            // Draw bullet
            ctx.fillStyle = bullet.color;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            return true;
        });

        // Draw towers
        towerManager.draw(ctx);

        ctx.restore()
    }

        // Update tower menu UI
        if (isTowerMenuOpen) {
            const towerItems = towerMenuPanel.querySelectorAll('.tower-item');
            
            towerItems.forEach(item => {
                const towerType = item.getAttribute('data-type') as 'basic' | 'sniper' | 'splash';
                const cost = towerManager.getTowerCost(towerType);
                
                // Update disabled state based on currency
                if (playerCurrency < cost) {
                    item.classList.add('disabled');
                } else {
                    item.classList.remove('disabled');
                }
            });

            // Update currency display
            const currencyAmount = towerMenuPanel.querySelector('.currency-amount');
            if (currencyAmount) {
                currencyAmount.textContent = playerCurrency.toString();
            }
        }

        // Draw tower placement preview
        if (hoveredTowerType) {
            const towerType = towerManager.towerTypes[hoveredTowerType];
            
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = towerType.color;
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw range preview
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, towerType.range, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    } else if (currentScreen === 'main') {
        // Draw main menu/lobby background
        await drawLevelBackground(ctx, mainMenuBackground, GAME_WIDTH, GAME_HEIGHT);

        // Draw title
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MultiRogue', GAME_WIDTH/2, 100);
        
        // Draw menu options
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        
        // Single Player button
        const singlePlayerY = GAME_HEIGHT/2;
        const buttonWidth = 240;
        const buttonHeight = 50;
        const buttonX = GAME_WIDTH/2 - buttonWidth/2;

        // Check if mouse is over single player button
        const isOverSinglePlayer = mouseX > buttonX && mouseX < buttonX + buttonWidth &&
            mouseY > singlePlayerY - buttonHeight/2 && mouseY < singlePlayerY + buttonHeight/2;

        // Draw single player button background with gradient
        const singlePlayerGradient = ctx.createLinearGradient(buttonX, singlePlayerY - buttonHeight/2, buttonX, singlePlayerY + buttonHeight/2);
        singlePlayerGradient.addColorStop(0, isOverSinglePlayer ? '#4a90e2' : '#357abd');
        singlePlayerGradient.addColorStop(1, isOverSinglePlayer ? '#357abd' : '#2a5f9e');
        ctx.fillStyle = singlePlayerGradient;
        ctx.fillRect(buttonX, singlePlayerY - buttonHeight/2, buttonWidth, buttonHeight);

        // Draw button border with glow effect
        ctx.strokeStyle = isOverSinglePlayer ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(buttonX, singlePlayerY - buttonHeight/2, buttonWidth, buttonHeight);

        // Add subtle inner shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(buttonX + 2, singlePlayerY - buttonHeight/2 + 2, buttonWidth - 4, 2);

        // Draw button text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('Single Player', GAME_WIDTH/2, singlePlayerY + 8);

        // Multiplayer button
        const multiplayerY = GAME_HEIGHT/2 + 70;
        const multiplayerY1 = multiplayerY - buttonHeight/2;
        const multiplayerY2 = multiplayerY + buttonHeight/2;

        // Check if mouse is over multiplayer button
        const isOverMultiplayer = mouseX > buttonX && mouseX < buttonX + buttonWidth &&
            mouseY > multiplayerY1 && mouseY < multiplayerY2;

        // Draw multiplayer button background with gradient
        const multiplayerGradient = ctx.createLinearGradient(buttonX, multiplayerY1, buttonX, multiplayerY2);
        multiplayerGradient.addColorStop(0, isOverMultiplayer ? '#e24a4a' : '#bd3535');
        multiplayerGradient.addColorStop(1, isOverMultiplayer ? '#bd3535' : '#9e2a2a');
        ctx.fillStyle = multiplayerGradient;
        ctx.fillRect(buttonX, multiplayerY1, buttonWidth, buttonHeight);

        // Draw button border with glow effect
        ctx.strokeStyle = isOverMultiplayer ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(buttonX, multiplayerY1, buttonWidth, buttonHeight);

        // Add subtle inner shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(buttonX + 2, multiplayerY1 + 2, buttonWidth - 4, 2);

        // Draw button text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('Multiplayer', GAME_WIDTH/2, multiplayerY + 8);

        // Draw debug info
        if (debugMode) {
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Mouse: ${Math.round(mouseX)}, ${Math.round(mouseY)}`, 10, GAME_HEIGHT - 30);
            ctx.fillText(`Button areas:`, 10, GAME_HEIGHT - 50);
            ctx.fillText(`Single: ${buttonX},${singlePlayerY - buttonHeight/2} - ${buttonX + buttonWidth},${singlePlayerY + buttonHeight/2}`, 10, GAME_HEIGHT - 70);
            ctx.fillText(`Multi: ${buttonX},${multiplayerY1} - ${buttonX + buttonWidth},${multiplayerY2}`, 10, GAME_HEIGHT - 90);
        }
    } else if (currentScreen === 'lobby') {
        // Draw lobby screen
        await drawLevelBackground(ctx, mainMenuBackground, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = 'white'
    ctx.font = '48px Arial'
    ctx.textAlign = 'center'
        ctx.fillText('Waiting for players...', GAME_WIDTH/2, GAME_HEIGHT/2)
    } else if (currentScreen === 'gameOver') {
        // Draw semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Draw game over text
        ctx.fillStyle = 'white';
        ctx.font = '64px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', GAME_WIDTH/2, GAME_HEIGHT/3);

        // Draw stats
        ctx.font = '32px Arial';
        ctx.fillText(`Rounds Completed: ${enemyManager.getCurrentRound() - 1}`, GAME_WIDTH/2, GAME_HEIGHT/2);

        // Draw buttons
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonSpacing = 20;
        const totalHeight = buttonHeight * 2 + buttonSpacing;
        const startY = GAME_HEIGHT/2 + 50;

        // Play Again button
        const playAgainY = startY;
        const isOverPlayAgain = mouseX > GAME_WIDTH/2 - buttonWidth/2 && 
                               mouseX < GAME_WIDTH/2 + buttonWidth/2 &&
                               mouseY > playAgainY && 
                               mouseY < playAgainY + buttonHeight;

        ctx.fillStyle = isOverPlayAgain ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(GAME_WIDTH/2 - buttonWidth/2, playAgainY, buttonWidth, buttonHeight);
        ctx.strokeStyle = isOverPlayAgain ? 'white' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(GAME_WIDTH/2 - buttonWidth/2, playAgainY, buttonWidth, buttonHeight);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText('Play Again', GAME_WIDTH/2, playAgainY + 35);

        // Main Menu button
        const mainMenuY = startY + buttonHeight + buttonSpacing;
        const isOverMainMenu = mouseX > GAME_WIDTH/2 - buttonWidth/2 && 
                              mouseX < GAME_WIDTH/2 + buttonWidth/2 &&
                              mouseY > mainMenuY && 
                              mouseY < mainMenuY + buttonHeight;

        ctx.fillStyle = isOverMainMenu ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(GAME_WIDTH/2 - buttonWidth/2, mainMenuY, buttonWidth, buttonHeight);
        ctx.strokeStyle = isOverMainMenu ? 'white' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(GAME_WIDTH/2 - buttonWidth/2, mainMenuY, buttonWidth, buttonHeight);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText('Main Menu', GAME_WIDTH/2, mainMenuY + 35);
    }

    // Draw debug overlay (always on top)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(10, 10, 420, 90);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`currentLevel: ${currentLevel}`, 20, 35);
    ctx.fillText(`background: ${debugBgName}`, 20, 55);
    ctx.fillText(`Round: ${enemyManager.getCurrentRound()}`, 20, 75);
    ctx.fillText(`Lives: ${enemyManager.getLives()}`, 20, 95);
    if (debugBgError) {
        ctx.fillStyle = 'red';
        ctx.fillText(`bg error: ${debugBgError}`, 20, 115);
    }
    ctx.restore();

    // Draw debug menu if debug mode is enabled
    if (debugMode) {
        drawDebugMenu();
    }

    requestAnimationFrame(render)
}

// Start render loop
render();

// Draw debug menu
function drawDebugMenu() {
    const menuX = 10;
    const menuY = 10;
    const lineHeight = 20;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(menuX, menuY, 200, 100);
    
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    
    // Debug mode status
    ctx.fillText(`Debug Mode: ${debugMode ? 'ON' : 'OFF'}`, menuX + 10, menuY + lineHeight);
    
    // Grid toggle
    ctx.fillText(`Grid: ${isGridVisible() ? 'ON' : 'OFF'}`, menuX + 10, menuY + lineHeight * 2);
    
    // Instructions
    ctx.fillText('Press ` to toggle debug', menuX + 10, menuY + lineHeight * 3);
    ctx.fillText('Press G to toggle grid', menuX + 10, menuY + lineHeight * 4);

    // Add grid toggle button
    const gridButtonX = 10;
    const gridButtonY = 120;
    const gridButtonWidth = 200;
    const gridButtonHeight = 30;

    // Draw button background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(gridButtonX, gridButtonY, gridButtonWidth, gridButtonHeight);

    // Draw button text
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Grid: ${isGridVisible() ? 'ON' : 'OFF'}`, gridButtonX + 10, gridButtonY + 20);

    // Add click handler for grid toggle
    canvas.addEventListener('click', (e) => {
        if (debugMode) {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            if (clickX >= gridButtonX && clickX <= gridButtonX + gridButtonWidth &&
                clickY >= gridButtonY && clickY <= gridButtonY + gridButtonHeight) {
                toggleGrid();
            }
        }
    });
}

// Add keyboard event listener for debug controls
window.addEventListener('keydown', (e) => {
    if (e.key === '`') {
        debugMode = !debugMode;
    }
    if (e.key && e.key.toLowerCase() === 'g') {
        toggleGrid();
    }
});

// Handle window resize
window.addEventListener('resize', resizeCanvas)
// Initial resize
resizeCanvas()

// Start the game
init().catch(error => {
    console.error('Failed to initialize game:', error)
})

// When setup modal is shown, set currentScreen to 'main'
setupModal.style.display = 'flex'
currentScreen = 'main'

// Add fullscreen helper function
async function enterFullscreen() {
    try {
        await document.body.requestFullscreen()
        if (screen.orientation && 'lock' in screen.orientation) {
            await (screen.orientation as any).lock('landscape')
        }
    } catch (err) {
        console.error('Error entering fullscreen:', err)
    }
}

// Update canvas click handler
canvas.addEventListener('click', async (e) => {
    if (currentScreen === 'main') {
        const rect = canvas.getBoundingClientRect()
        const scale = rect.width / canvas.width
        const clickX = (e.clientX - rect.left) / scale
        const clickY = (e.clientY - rect.top) / scale

        // Button dimensions
        const buttonWidth = 200
        const buttonHeight = 40
        const buttonX = canvas.width/2 - buttonWidth/2

        // Single Player button
        const singlePlayerY = canvas.height/2
        const singlePlayerY1 = singlePlayerY - buttonHeight/2
        const singlePlayerY2 = singlePlayerY + buttonHeight/2

        if (clickY > singlePlayerY1 && clickY < singlePlayerY2 &&
            clickX > buttonX && clickX < buttonX + buttonWidth) {
            await enterFullscreen()
            isSinglePlayer = true
            currentScreen = 'game'
            // Initialize single player game
            gameStarted = true
            // Initialize game
            game.initialize()
            // Set up player
            player = {
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: 0,
                vy: 0,
                angle: -Math.PI/2, // Point upward
                shipType: selectedShip,
                name: 'Player'
            }
            // Show tower menu button
            towerMenuBtn.style.display = 'flex';
            return
        }

        // Multiplayer button
        const multiplayerY = canvas.height/2 + 50
        const multiplayerY1 = multiplayerY - buttonHeight/2
        const multiplayerY2 = multiplayerY + buttonHeight/2

        if (clickY > multiplayerY1 && clickY < multiplayerY2 &&
            clickX > buttonX && clickX < buttonX + buttonWidth) {
            await enterFullscreen()
            isSinglePlayer = false
            setupModal.style.display = 'flex'
            currentScreen = 'main'
            return
        }
    }
});

// Update click handler for game over screen
canvas.addEventListener('click', (e) => {
    if (currentScreen === 'gameOver') {
        const rect = canvas.getBoundingClientRect();
        const scale = window.innerHeight / GAME_HEIGHT;
        const GAME_WIDTH = window.innerWidth / scale;
        const clickX = (e.clientX - rect.left) / scale;
        const clickY = (e.clientY - rect.top) / scale;

        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonSpacing = 20;
        const startY = GAME_HEIGHT/2 + 50;

        // Play Again button
        if (clickY > startY && clickY < startY + buttonHeight &&
            clickX > GAME_WIDTH/2 - buttonWidth/2 && clickX < GAME_WIDTH/2 + buttonWidth/2) {
            // Reset game state
            enemyManager.resetLives();
            enemyManager.resetRound();
            currentScreen = 'game';
            gameStarted = true;
            return;
        }

        // Main Menu button
        if (clickY > startY + buttonHeight + buttonSpacing && 
            clickY < startY + buttonHeight * 2 + buttonSpacing &&
            clickX > GAME_WIDTH/2 - buttonWidth/2 && clickX < GAME_WIDTH/2 + buttonWidth/2) {
            currentScreen = 'main';
            return;
        }
    }
});

// Update click handler for tower placement
canvas.addEventListener('click', (e) => {
    if (currentScreen === 'game') {
        const rect = canvas.getBoundingClientRect();
        const scale = window.innerHeight / GAME_HEIGHT;
        const clickX = (e.clientX - rect.left) / scale;
        const clickY = (e.clientY - rect.top) / scale;

        // Handle tower placement
        if (towerManager.isPlacing()) {
            const cost = towerManager.getTowerCost(towerManager.getSelectedTowerType());
            if (playerCurrency >= cost) {
                const tower = towerManager.placeTower(clickX, clickY);
                if (tower) {
                    playerCurrency -= cost;
                    // Update currency display
                    const currencyAmount = towerMenuPanel.querySelector('.currency-amount');
                    if (currencyAmount) {
                        currencyAmount.textContent = playerCurrency.toString();
                    }
                    // Send tower placement to other player
                    network.sendTowerPlacement(tower);
                }
            }
        }
    }
});

// Update mousemove handler for tower placement preview
canvas.addEventListener('mousemove', (e) => {
    if (currentScreen === 'game') {
        const rect = canvas.getBoundingClientRect();
        const scale = window.innerHeight / GAME_HEIGHT;
        mouseX = (e.clientX - rect.left) / scale;
        mouseY = (e.clientY - rect.top) / scale;

        // Update tower placement preview
        towerManager.updatePlacementPreview(mouseX, mouseY);
    }
});

// Update game loop
function gameLoop(timestamp: number) {
    if (currentScreen === 'game' && gameStarted) {
        // Update towers
        towerManager.update(enemyManager.getEnemies(), timestamp);
    }
    // ... rest of existing game loop code ...
}