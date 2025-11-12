const socket = io();

// --- DOM Elements ---
const welcomeScreen = document.getElementById('welcome-screen');
const rulesScreen = document.getElementById('rules-screen');
const usernameScreen = document.getElementById('username-screen');
const usernameInput = document.getElementById('username-input');
const usernameError = document.getElementById('username-error');
const gameModeScreen = document.getElementById('game-mode-screen');
const difficultyScreen = document.getElementById('difficulty-screen');
const roomScreen = document.getElementById('room-screen');
const tournamentJoinScreen = document.getElementById('tournament-join-screen');
const tournamentWaitScreen = document.getElementById('tournament-wait-screen');
const tournamentBracketScreen = document.getElementById('tournament-bracket-screen');
const bracketContainer = document.getElementById('bracket-container');
const tournamentStatusText = document.getElementById('tournament-status-text');
const tournamentLobbyIdInput = document.getElementById('tournament-lobby-id-input');
const tournamentErrorMsg = document.getElementById('tournament-error-msg');
const waitLobbyIdDisplay = document.getElementById('wait-lobby-id-display');
const waitLobbyStatusText = document.getElementById('wait-lobby-status-text');
const waitLobbyPlayers = document.getElementById('wait-lobby-players');
const roomIdDisplay = document.getElementById('room-id-display');
const roomIdInput = document.getElementById('room-id-input');
const roomErrorMsg = document.getElementById('room-error-msg');
const tossScreen = document.getElementById('toss-screen');
const gameScreen = document.getElementById('game-screen');
const tossResultEl = document.getElementById('toss-result');
const tossSelectionEl = document.getElementById('toss-selection');
const playerDecisionEl = document.getElementById('player-decision');
const playerScoreEl = document.getElementById('player-score');
const opponentScoreEl = document.getElementById('opponent-score');
const playerStatsEl = document.getElementById('player-stats');
const opponentStatsEl = document.getElementById('opponent-stats');
const targetEl = document.getElementById('target');
const gameStatusEl = document.getElementById('game-status');
const playerThrowEl = document.getElementById('player-throw-display');
const opponentThrowEl = document.getElementById('opponent-throw-display');
const playAgainBtn = document.getElementById('play-again-btn');
const choiceButtons = document.querySelectorAll('.choice-btn');

// --- Game Constants ---
const MAX_WICKETS = 10;
const MAX_BALLS = 30;

// --- Game State Variables ---
let playerUsername = '';
let gameMode = 'ai';
let isPlayerBatting = true;
let isGameOver = false;
let currentOpponentName = '';

// --- AI-Only Variables ---
let aiDifficulty = 'easy';
let playerScoreAI = 0, aiScore = 0;
let playerWicketsAI = 0, aiWickets = 0;
let playerBallsAI = 0, aiBalls = 0;
let targetScoreAI = 0;
let currentInningsAI = 1;
let lastPlayerThrow = 0;
let playerBatHistory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let playerBowlHistory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

// Debug logging
function debugLog(message, data = null) {
    console.log(`[CLIENT] ${message}`, data || '');
}

// --- Screen Management Functions ---
function hideAllScreens() {
    const screens = [
        'welcome-screen', 'rules-screen', 'username-screen', 'game-mode-screen', 
        'difficulty-screen', 'room-screen', 'tournament-join-screen', 
        'tournament-wait-screen', 'tournament-bracket-screen', 'toss-screen', 'game-screen'
    ];
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) element.classList.add('hidden');
    });
}

function showScreen(screenId) {
    hideAllScreens();
    const element = document.getElementById(screenId);
    if (element) element.classList.remove('hidden');
}

// --- Welcome & Rules Navigation ---
function showRules() {
    showScreen('rules-screen');
}

function showUsernameScreen() {
    showScreen('username-screen');
}

function goBackToWelcome() {
    showScreen('welcome-screen');
}

// --- Username Setup ---
function setUsername() {
    const username = usernameInput.value.trim();
    if (username.length < 2) {
        usernameError.innerText = 'Username must be at least 2 characters long';
        return;
    }
    if (username.length > 15) {
        usernameError.innerText = 'Username must be less than 15 characters';
        return;
    }
    
    usernameError.innerText = '';
    debugLog('Setting username', { username });
    socket.emit('setUsername', username);
}

socket.on('usernameSet', (data) => {
    if (data.success) {
        playerUsername = data.username;
        debugLog('Username set successfully', { username: playerUsername });
        showScreen('game-mode-screen');
    } else {
        usernameError.innerText = data.error || 'Failed to set username';
    }
});

// --- Step 1: Select Game Mode ---
function selectGameMode(mode) {
    gameMode = mode;
    if (mode === 'ai') {
        showScreen('difficulty-screen');
    } else if (mode === 'online') {
        showScreen('room-screen');
        roomErrorMsg.innerText = '';
        roomIdDisplay.innerText = '';
        roomIdInput.value = '';
    } else if (mode === 'tournament') {
        showScreen('tournament-join-screen');
        tournamentErrorMsg.innerText = '';
        tournamentLobbyIdInput.value = '';
    }
}

// --- Tournament Lobby Functions ---
function createTournament(size) {
    tournamentErrorMsg.innerText = '';
    debugLog('Creating tournament', { size });
    socket.emit('createTournamentLobby', { size: size });
}

function joinTournament() {
    const lobbyId = tournamentLobbyIdInput.value.toUpperCase();
    tournamentErrorMsg.innerText = '';
    if (lobbyId && lobbyId.length >= 5 && lobbyId.length <= 7) {
        debugLog('Joining tournament', { lobbyId });
        socket.emit('joinTournamentLobby', lobbyId);
    } else {
        tournamentErrorMsg.innerText = 'Please enter a valid Lobby ID.';
    }
}

function leaveTournamentLobby() {
    debugLog('Leaving tournament lobby');
    socket.emit('leaveTournamentLobby');
    showScreen('game-mode-screen');
}

function goBackToMain() {
    showScreen('game-mode-screen');
}

// --- 1v1 Online Room Functions ---
function createRoom() {
    roomErrorMsg.innerText = '';
    debugLog('Creating room');
    socket.emit('createRoom');
}

function joinRoom() {
    const roomId = roomIdInput.value.toUpperCase();
    roomErrorMsg.innerText = '';
    if (roomId && roomId.length === 5) {
        debugLog('Joining room', { roomId });
        socket.emit('joinRoom', roomId);
    } else {
        roomErrorMsg.innerText = 'Please enter a valid 5-character Room ID.';
    }
}

// --- AI Toss/Game Logic ---
function selectDifficulty(level) {
    aiDifficulty = level;
    showScreen('toss-screen');
    tossResultEl.innerText = '';
    tossSelectionEl.classList.remove('hidden');
    playerDecisionEl.classList.add('hidden');
}

function handleToss(choice) {
    if (gameMode === 'ai') {
        tossSelectionEl.classList.add('hidden');
        const coinToss = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const didPlayerWinToss = choice === coinToss;
        
        tossResultEl.innerText = `Coin was ${coinToss}. You ${didPlayerWinToss ? 'WON' : 'LOST'} the toss!`;
        
        if (didPlayerWinToss) {
            playerDecisionEl.classList.remove('hidden');
        } else {
            const aiDecision = Math.random() < 0.5 ? 'Bat' : 'Bowl';
            tossResultEl.innerText += `\nAI chooses to ${aiDecision}.`;
            isPlayerBatting = (aiDecision === 'Bowl');
            setTimeout(startGameAI, 2500);
        }
    } else {
        tossSelectionEl.classList.add('hidden');
        tossResultEl.innerText = `You chose ${choice}. Waiting for result...`;
        debugLog('Sending toss choice', { choice });
        socket.emit('tossChoice', choice);
    }
}

function playerChoose(choice) {
    if (gameMode === 'ai') {
        isPlayerBatting = (choice === 'Bat');
        playerDecisionEl.classList.add('hidden');
        startGameAI();
    } else {
        playerDecisionEl.classList.add('hidden');
        debugLog('Sending bat/bowl choice', { choice });
        socket.emit('batBowlChoice', choice);
    }
}

function startGameAI() {
    gameStatusEl.innerText = isPlayerBatting ? "You are batting" : "You are bowling";
    showScreen('game-screen');
    document.getElementById('player-score-box').querySelector('h3').innerText = `${playerUsername}'s Score`;
    document.getElementById('opponent-score-box').querySelector('h3').innerText = "AI Score";
    toggleChoiceButtons(false);
    
    isGameOver = false;
    playAgainBtn.classList.add('hidden');
}

// --- Main Game Function ---
function playTurn(playerThrow) {
    if (isGameOver) return;
    if (gameMode === 'ai') {
        playTurnAI(playerThrow);
    } else {
        playerThrowEl.innerText = "X";
        opponentThrowEl.innerText = "?";
        gameStatusEl.innerText = "You played. Waiting for opponent...";
        toggleChoiceButtons(true);
        debugLog('Sending player throw', { throw: playerThrow });
        socket.emit('playerThrow', { throw: playerThrow });
    }
}

// --- AI Game Logic ---
function playTurnAI(playerThrow) {
    const aiThrow = getAiThrow();
    playerThrowEl.innerText = playerThrow;
    opponentThrowEl.innerText = aiThrow;
    if (isPlayerBatting) playerBatHistory[playerThrow]++;
    else playerBowlHistory[playerThrow]++;
    lastPlayerThrow = playerThrow;
    let isOut = playerThrow === aiThrow;
    
    if (isPlayerBatting) {
        playerBallsAI++;
        if (isOut) {
            playerWicketsAI++;
            gameStatusEl.innerText = `OUT! ${MAX_WICKETS - playerWicketsAI} wickets left.`;
        } else {
            playerScoreAI += playerThrow;
            playerScoreEl.innerText = playerScoreAI;
            gameStatusEl.innerText = `You scored ${playerThrow} runs.`;
        }
        playerStatsEl.innerText = `Wkts: ${playerWicketsAI} | Overs: ${formatOvers(playerBallsAI)}`;
    } else {
        aiBalls++;
        if (isOut) {
            aiWickets++;
            gameStatusEl.innerText = `OUT! AI has ${MAX_WICKETS - aiWickets} wickets left.`;
        } else {
            aiScore += aiThrow;
            opponentScoreEl.innerText = aiScore;
            gameStatusEl.innerText = `AI scored ${aiThrow} runs.`;
        }
        opponentStatsEl.innerText = `Wkts: ${aiWickets} | Overs: ${formatOvers(aiBalls)}`;
    }
    
    const inningsOver = (
        (isPlayerBatting && (playerWicketsAI >= MAX_WICKETS || playerBallsAI >= MAX_BALLS)) ||
        (!isPlayerBatting && (aiWickets >= MAX_WICKETS || aiBalls >= MAX_BALLS))
    );
    
    if (inningsOver && currentInningsAI === 1) {
        targetScoreAI = (isPlayerBatting ? playerScoreAI : aiScore) + 1;
        targetEl.innerText = `Target: ${targetScoreAI}`;
        currentInningsAI = 2;
        isPlayerBatting = !isPlayerBatting;
        gameStatusEl.innerText = `Innings over! ${isPlayerBatting ? 'You are batting (Chasing)' : 'You are bowling (Defending)'}`;
        return;
    }
    
    if (currentInningsAI === 2) {
        if ((isPlayerBatting && playerScoreAI >= targetScoreAI) || 
            (!isPlayerBatting && aiScore >= targetScoreAI) || inningsOver) {
            endGameAI();
        }
    }
}

function endGameAI() {
    isGameOver = true;
    toggleChoiceButtons(true);
    playAgainBtn.classList.remove('hidden');
    
    if (playerScoreAI > aiScore) {
        const margin = isPlayerBatting ? `${MAX_WICKETS - playerWicketsAI} wickets` : `${playerScoreAI - aiScore} runs`;
        gameStatusEl.innerText = `YOU WIN! (by ${margin})`;
    } else if (aiScore > playerScoreAI) {
        const margin = !isPlayerBatting ? `${MAX_WICKETS - aiWickets} wickets` : `${aiScore - playerScoreAI} runs`;
        gameStatusEl.innerText = `AI WINS! (by ${margin})`;
    } else {
        gameStatusEl.innerText = "IT'S A TIE!";
    }
}

function getAiThrow() {
    let aiThrow = 0;
    const randomThrow = () => Math.floor(Math.random() * 6) + 1;
    
    switch (aiDifficulty) {
        case 'easy': 
            aiThrow = randomThrow();
            break;
        case 'medium':
            if (Math.random() < 0.6) {
                aiThrow = randomThrow();
            } else {
                aiThrow = lastPlayerThrow || randomThrow();
                if (!isPlayerBatting && aiThrow === lastPlayerThrow) {
                    aiThrow = (aiThrow % 6) + 1;
                }
            }
            break;
        case 'hard':
            let history = isPlayerBatting ? playerBatHistory : playerBowlHistory;
            let mostFrequent = Object.keys(history).reduce((a, b) => history[a] > history[b] ? a : b);
            let maxCount = history[mostFrequent];
            mostFrequent = parseInt(mostFrequent);
            
            if (isPlayerBatting && Math.random() < 0.5 && maxCount > 0) {
                aiThrow = mostFrequent;
            } else if (!isPlayerBatting && Math.random() < 0.7 && maxCount > 0) {
                aiThrow = randomThrow();
                if (aiThrow === mostFrequent) {
                    aiThrow = (aiThrow % 6) + 1;
                }
            } else {
                aiThrow = randomThrow();
            }
            break;
    }
    return aiThrow;
}

// --- ONLINE: Socket.io Event Listeners ---
socket.on('roomCreated', (roomId) => {
    roomIdDisplay.innerText = `Room Created! Your ID is: ${roomId}`;
    roomErrorMsg.innerText = 'Give this ID to your friend.';
    roomIdInput.value = '';
});

socket.on('errorMsg', (message) => {
    roomErrorMsg.innerText = message;
    debugLog('Error message', { message });
});

socket.on('startToss', (data) => {
    debugLog('Start toss received', data);
    
    if (gameMode !== 'tournament') {
        gameMode = 'online';
    }
    
    showScreen('toss-screen');
    
    if (data.isChooser) {
        tossResultEl.innerText = 'You are tossing. Choose Heads or Tails.';
        tossSelectionEl.classList.remove('hidden');
        playerDecisionEl.classList.add('hidden');
    } else {
        tossResultEl.innerText = 'Opponent is tossing. Please wait...';
        tossSelectionEl.classList.add('hidden');
        playerDecisionEl.classList.add('hidden');
    }
});

socket.on('tossResult', (data) => {
    debugLog('Toss result received', data);
    const didIWin = (socket.id === data.winnerId);
    const winnerName = data.winnerName || `Player ${data.winnerId.substring(0, 5)}`;
    tossResultEl.innerText = `Coin was ${data.coinToss}. ${winnerName} won the toss!\nYou ${didIWin ? 'WON' : 'LOST'} the toss!`;
});

socket.on('chooseBatBowl', () => {
    debugLog('Choose bat/bowl received');
    playerDecisionEl.classList.remove('hidden');
});

socket.on('gameStart', (data) => {
    debugLog('Game start received', data);
    isPlayerBatting = data.isBatting;
    currentOpponentName = data.opponentName;
    
    document.getElementById('player-score-box').querySelector('h3').innerText = `${playerUsername}'s Score`;
    document.getElementById('opponent-score-box').querySelector('h3').innerText = `${currentOpponentName}'s Score`;
    
    showScreen('game-screen');
    gameStatusEl.innerText = isPlayerBatting ? 
        `You are batting against ${currentOpponentName}. Choose a number.` : 
        `You are bowling against ${currentOpponentName}. Choose a number.`;
    toggleChoiceButtons(false);
    
    isGameOver = false;
    playAgainBtn.classList.add('hidden');
    
    playerScoreEl.innerText = "0";
    opponentScoreEl.innerText = "0";
    playerStatsEl.innerText = "Wkts: 0 | Overs: 0.0";
    opponentStatsEl.innerText = "Wkts: 0 | Overs: 0.0";
    targetEl.innerText = "Target: --";
    playerThrowEl.innerText = "?";
    opponentThrowEl.innerText = "?";
});

socket.on('turnResult', (data) => {
    debugLog('Turn result received', data);
    
    playerThrowEl.innerText = data.yourThrow;
    opponentThrowEl.innerText = data.opponentThrow;
    playerScoreEl.innerText = data.yourScore;
    opponentScoreEl.innerText = data.opponentScore;
    playerStatsEl.innerText = `Wkts: ${data.yourWickets} | Overs: ${formatOvers(data.yourBalls)}`;
    opponentStatsEl.innerText = `Wkts: ${data.opponentWickets} | Overs: ${formatOvers(data.opponentBalls)}`;
    
    if (data.currentInnings === 2) {
        targetEl.innerText = `Target: ${data.target}`;
    }
    
    let status = data.isOut ? "OUT!" : `${data.runs} runs scored!`;
    gameStatusEl.innerText = status + (data.isBatting ? " You are batting." : " You are bowling.");
    
    toggleChoiceButtons(false);
});

socket.on('inningsEnd', (data) => {
    debugLog('Innings end received', data);
    
    playerScoreEl.innerText = data.yourScore;
    opponentScoreEl.innerText = data.opponentScore;
    
    targetEl.innerText = `Target: ${data.target}`;
    isPlayerBatting = data.isBatting;
    gameStatusEl.innerText = `Innings Over! Target is ${data.target}. ${isPlayerBatting ? "You are batting." : "You are bowling."}`;
    toggleChoiceButtons(false);
});

socket.on('gameOver', (data) => {
    debugLog('Game over received', data);
    isGameOver = true;
    
    playerScoreEl.innerText = data.yourScore;
    opponentScoreEl.innerText = data.opponentScore;
    
    if (data.message.includes("YOU WIN")) {
        gameStatusEl.innerText = `🎉 ${data.message} 🎉`;
    } else {
        gameStatusEl.innerText = data.message;
    }
    
    toggleChoiceButtons(true);
    
    if (gameMode === 'tournament') {
        gameStatusEl.innerText += "\nWaiting for other matches...";
        setTimeout(() => {
            showScreen('tournament-bracket-screen');
        }, 3000);
    } else {
        playAgainBtn.classList.remove('hidden');
    }
});

socket.on('opponentDisconnected', () => {
    debugLog('Opponent disconnected');
    isGameOver = true;
    gameStatusEl.innerText = `${currentOpponentName} disconnected. You win!`;
    toggleChoiceButtons(true);

    if (gameMode === 'tournament') {
        setTimeout(() => {
            showScreen('tournament-bracket-screen');
        }, 3000);
    } else {
        playAgainBtn.classList.remove('hidden');
    }
});

socket.on('statusUpdate', (message) => {
    debugLog('Status update', { message });
    tossResultEl.innerText = message;
});

// --- Tournament Lobby Listeners ---
socket.on('tournamentLobbyCreated', (lobbyId) => {
    debugLog('Tournament lobby created', { lobbyId });
    showScreen('tournament-wait-screen');
    waitLobbyIdDisplay.innerText = `Lobby ID: ${lobbyId}`;
    waitLobbyStatusText.innerText = 'Waiting for players...';
    waitLobbyPlayers.innerHTML = `<li>${playerUsername} (You) - Host</li>`;
});

socket.on('tournamentLobbyJoined', (lobbyId) => {
    debugLog('Tournament lobby joined', { lobbyId });
    showScreen('tournament-wait-screen');
    waitLobbyIdDisplay.innerText = `Lobby ID: ${lobbyId}`;
    waitLobbyStatusText.innerText = 'Waiting for players...';
});

socket.on('tournamentLobbyUpdate', (data) => {
    debugLog('Tournament lobby update', data);
    waitLobbyStatusText.innerText = `Players waiting: ${data.count} / ${data.size}`;
    
    waitLobbyPlayers.innerHTML = '';
    data.players.forEach(player => {
        const isYou = player.id === socket.id;
        const isHost = player.id === data.host;
        const playerText = isYou ? `${player.username} (You)${isHost ? ' - Host' : ''}` : 
                                `${player.username}${isHost ? ' - Host' : ''}`;
        const li = document.createElement('li');
        li.textContent = playerText;
        waitLobbyPlayers.appendChild(li);
    });
    
    if (data.count === data.size) {
        waitLobbyStatusText.innerText = 'Lobby full! Generating bracket...';
    }
});

socket.on('tournamentError', (message) => {
    debugLog('Tournament error', { message });
    if (!tournamentJoinScreen.classList.contains('hidden')) {
        tournamentErrorMsg.innerText = message;
    } else {
        alert(message);
        leaveTournamentLobby();
    }
});

// --- Tournament Bracket Listeners ---
socket.on('tournamentBracketUpdate', (bracketData) => {
    debugLog('Tournament bracket update', bracketData);
    gameMode = 'tournament';
    
    let shouldBeInGame = false;
    let playerStatus = 'waiting';
    
    bracketData.forEach((round, roundIndex) => {
        round.forEach((match, matchIndex) => {
            if (match && (match.p1 === socket.id || match.p2 === socket.id)) {
                if (match.winner) {
                    if (match.winner === socket.id) {
                        playerStatus = 'advancing';
                    } else {
                        playerStatus = 'eliminated';
                    }
                } else {
                    shouldBeInGame = true;
                    playerStatus = 'playing';
                }
            }
        });
    });
    
    debugLog('Tournament status check', { shouldBeInGame, playerStatus });
    
    if (!shouldBeInGame) {
        showScreen('tournament-bracket-screen');
        renderBracket(bracketData, playerStatus);
    }
});

socket.on('tournamentWinner', (data) => {
    debugLog('Tournament winner', data);
    const isChampion = data.name === playerUsername || data.championId === socket.id;
    tournamentStatusText.innerText = `🏆 CHAMPION 🏆\n${isChampion ? 'YOU ARE THE CHAMPION!' : data.name}`;
    tournamentStatusText.className = 'champion';
});

// --- Bracket Rendering Function ---
function renderBracket(bracketData, playerStatus = 'waiting') {
    bracketContainer.innerHTML = '';
    
    if (!bracketData || bracketData.length === 0) {
        bracketContainer.innerHTML = '<p>Bracket data loading...</p>';
        return;
    }

    const statusTexts = {
        'playing': 'Your match is starting soon...',
        'advancing': 'You won! Waiting for next round...',
        'eliminated': 'You were eliminated. Tournament continues...',
        'champion': '🏆 YOU ARE THE CHAMPION! 🏆',
        'waiting': 'Tournament in progress...'
    };
    tournamentStatusText.innerText = statusTexts[playerStatus] || statusTexts.waiting;
    tournamentStatusText.className = playerStatus;

    bracketData.forEach((round, roundIndex) => {
        const roundEl = document.createElement('div');
        roundEl.className = 'bracket-round';
        roundEl.innerHTML = `<h3>Round ${roundIndex + 1}</h3>`;
        
        round.forEach((match, matchIndex) => {
            if (!match || !match.p1 || !match.p2) {
                return;
            }
            
            const matchEl = document.createElement('div');
            matchEl.className = 'bracket-match';
            
            const isPlayerP1 = match.p1 === socket.id;
            const isPlayerP2 = match.p2 === socket.id;
            
            let p1Class = 'bracket-player';
            if (match.winner === match.p1) p1Class += ' winner';
            if (isPlayerP1) p1Class += ' current-player';
            let p1Name = isPlayerP1 ? playerUsername : match.p1Name;
            
            let p2Class = 'bracket-player';
            if (match.winner === match.p2) p2Class += ' winner';
            if (isPlayerP2) p2Class += ' current-player';
            let p2Name = isPlayerP2 ? playerUsername : match.p2Name;
            
            matchEl.innerHTML = `
                <span class="${p1Class}">${p1Name}</span>
                <span style="color: #aaa;">vs</span>
                <span class="${p2Class}">${p2Name}</span>
            `;
            
            if (match.winner) {
                const statusEl = document.createElement('div');
                statusEl.style.fontSize = '0.8rem';
                statusEl.style.color = '#00ff80';
                const winnerName = match.winner === socket.id ? playerUsername : match.winnerName;
                statusEl.innerText = `Winner: ${winnerName}`;
                matchEl.appendChild(statusEl);
            }
            
            roundEl.appendChild(matchEl);
        });
        bracketContainer.appendChild(roundEl);
    });
}

// --- Utility Functions ---
function formatOvers(balls) {
    return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function toggleChoiceButtons(disable) {
    choiceButtons.forEach(button => button.disabled = disable);
}

function resetGame() {
    isGameOver = false;
    
    const currentMode = gameMode;
    
    playerScoreAI = 0; aiScore = 0; playerWicketsAI = 0; aiWickets = 0;
    playerBallsAI = 0; aiBalls = 0; targetScoreAI = 0; currentInningsAI = 1;
    lastPlayerThrow = 0;
    playerBatHistory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    playerBowlHistory = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    playerScoreEl.innerText = "0";
    opponentScoreEl.innerText = "0";
    playerStatsEl.innerText = "Wkts: 0 | Overs: 0.0";
    opponentStatsEl.innerText = "Wkts: 0 | Overs: 0.0";
    targetEl.innerText = "Target: --";
    playerThrowEl.innerText = "?";
    opponentThrowEl.innerText = "?";
    gameStatusEl.innerText = "";
    
    if (currentMode === 'tournament') {
        showScreen('tournament-bracket-screen');
    } else {
        showScreen('game-mode-screen');
        gameMode = 'ai';
    }
    
    playAgainBtn.classList.add('hidden');
    toggleChoiceButtons(false);
    
    debugLog('Game reset', { previousMode: currentMode });
}

// --- Global Error Handling ---
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
});

// Initialize the game
debugLog('Game initialized');
showScreen('welcome-screen');