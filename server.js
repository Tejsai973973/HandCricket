const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const MAX_WICKETS = 10;
const MAX_BALLS = 30;

let rooms = {};
let games = {};
let tournamentLobbies = {};
let activeTournaments = {};

// Debug logging
const DEBUG = true;
function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data || '');
    }
}

// Socket validation helper
function validateSocket(socket) {
    return socket && socket.connected;
}

// --- Server-side Game Class ---
class Game {
    constructor(p1, p2, roomId, tournament = null) {
        this.gameId = roomId;
        this.p1 = p1;
        this.p2 = p2;
        this.tournament = tournament;
        this.p1Throw = null;
        this.p2Throw = null;
        this.p1Score = 0;
        this.p2Score = 0;
        this.p1Wickets = 0;
        this.p2Wickets = 0;
        this.p1Balls = 0;
        this.p2Balls = 0;
        this.targetScore = 0;
        this.currentInnings = 1;
        this.isP1Batting = true;
        this.tossWinnerSocket = null;
        this.gameStarted = false;
        
        debugLog('Game created', { 
            gameId: roomId, 
            p1: p1.username || p1.id, 
            p2: p2.username || p2.id,
            tournament: !!tournament
        });
        
        this.p1.gameId = this.gameId;
        this.p2.gameId = this.gameId;
        this.p1.join(this.gameId);
        this.p2.join(this.gameId);
    }

    startToss() {
        debugLog('Starting toss', { gameId: this.gameId });
        this.p1.emit('startToss', { isChooser: true });
        this.p2.emit('startToss', { isChooser: false });
    }

    handleTossChoice(choice) {
        debugLog('Toss choice received', { gameId: this.gameId, choice });
        const coinToss = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const didP1Win = (choice === coinToss);
        this.tossWinnerSocket = didP1Win ? this.p1 : this.p2;
        const loserSocket = didP1Win ? this.p2 : this.p1;
        
        io.to(this.gameId).emit('tossResult', { 
            winnerId: this.tossWinnerSocket.id, 
            winnerName: this.tossWinnerSocket.username || this.tossWinnerSocket.id,
            coinToss: coinToss, 
            choice: choice 
        });
        
        this.tossWinnerSocket.emit('chooseBatBowl');
        loserSocket.emit('statusUpdate', 'You lost the toss. Waiting for opponent...');
    }

    handleBatBowlChoice(socket, choice) {
        if (!validateSocket(socket) || socket.id !== this.tossWinnerSocket.id) {
            debugLog('Invalid bat/bowl choice', { socket: socket.id, winner: this.tossWinnerSocket.id });
            return;
        }
        
        debugLog('Bat/bowl choice received', { gameId: this.gameId, choice });
        const winnerIsP1 = this.tossWinnerSocket.id === this.p1.id;
        const winnerChoseBat = (choice === 'Bat');
        this.isP1Batting = (winnerIsP1 && winnerChoseBat) || (!winnerIsP1 && !winnerChoseBat);
        this.startGame();
    }

    startGame() {
        debugLog('Starting game', { 
            gameId: this.gameId, 
            p1Batting: this.isP1Batting 
        });
        
        this.gameStarted = true;
        
        this.p1.emit('gameStart', { 
            opponentId: this.p2.id, 
            opponentName: this.p2.username || `Player ${this.p2.id.substring(0, 5)}`,
            isBatting: this.isP1Batting 
        });
        
        this.p2.emit('gameStart', { 
            opponentId: this.p1.id, 
            opponentName: this.p1.username || `Player ${this.p1.id.substring(0, 5)}`,
            isBatting: !this.isP1Batting 
        });
    }

    handleThrow(socket, playerThrow) {
        if (!validateSocket(socket)) {
            debugLog('Invalid socket for throw', { socket: socket.id });
            return;
        }

        if (playerThrow < 1 || playerThrow > 6) {
            socket.emit('errorMsg', 'Invalid throw. Must be between 1-6.');
            return;
        }

        debugLog('Player throw received', { 
            gameId: this.gameId, 
            player: socket.username || socket.id, 
            throw: playerThrow 
        });

        if (socket.id === this.p1.id) this.p1Throw = playerThrow;
        else this.p2Throw = playerThrow;

        if (this.p1Throw === null || this.p2Throw === null) {
            socket.emit('statusUpdate', 'Waiting for opponent...');
            return;
        }

        let batsman, bowler, batsmanThrow, bowlerThrow;
        
        if (this.isP1Batting) {
            batsman = this.p1; bowler = this.p2;
            batsmanThrow = this.p1Throw; bowlerThrow = this.p2Throw;
        } else {
            batsman = this.p2; bowler = this.p1;
            batsmanThrow = this.p2Throw; bowlerThrow = this.p1Throw;
        }

        let isOut = batsmanThrow === bowlerThrow;
        let runs = isOut ? 0 : batsmanThrow;

        if (this.isP1Batting) {
            this.p1Balls++;
            if (isOut) this.p1Wickets++; else this.p1Score += runs;
        } else {
            this.p2Balls++;
            if (isOut) this.p2Wickets++; else this.p2Score += runs;
        }

        // Send personalized turn results
        const p1TurnResult = { 
            yourThrow: this.p1Throw,
            opponentThrow: this.p2Throw,
            isOut: isOut, 
            runs: runs,
            yourScore: this.p1Score,
            opponentScore: this.p2Score,
            yourWickets: this.p1Wickets,
            opponentWickets: this.p2Wickets,
            yourBalls: this.p1Balls,
            opponentBalls: this.p2Balls,
            isBatting: (this.p1.id === batsman.id),
            target: this.targetScore,
            currentInnings: this.currentInnings
        };
        
        const p2TurnResult = { 
            yourThrow: this.p2Throw,
            opponentThrow: this.p1Throw,
            isOut: isOut, 
            runs: runs,
            yourScore: this.p2Score,
            opponentScore: this.p1Score,
            yourWickets: this.p2Wickets,
            opponentWickets: this.p1Wickets,
            yourBalls: this.p2Balls,
            opponentBalls: this.p1Balls,
            isBatting: (this.p2.id === batsman.id),
            target: this.targetScore,
            currentInnings: this.currentInnings
        };
        
        this.p1.emit('turnResult', p1TurnResult);
        this.p2.emit('turnResult', p2TurnResult);

        this.p1Throw = null;
        this.p2Throw = null;
        
        const currentWickets = this.isP1Batting ? this.p1Wickets : this.p2Wickets;
        const currentBalls = this.isP1Batting ? this.p1Balls : this.p2Balls;
        const inningsOver = (currentWickets >= MAX_WICKETS || currentBalls >= MAX_BALLS);

        if (inningsOver && this.currentInnings === 1) {
            this.currentInnings = 2; 
            this.targetScore = (this.isP1Batting ? this.p1Score : this.p2Score) + 1;
            this.isP1Batting = !this.isP1Batting;
            
            debugLog('First innings over', { 
                gameId: this.gameId, 
                target: this.targetScore 
            });
            
            this.p1.emit('inningsEnd', { 
                target: this.targetScore, 
                isBatting: this.isP1Batting,
                yourScore: this.p1Score,
                opponentScore: this.p2Score
            });
            this.p2.emit('inningsEnd', { 
                target: this.targetScore, 
                isBatting: !this.isP1Batting,
                yourScore: this.p2Score,
                opponentScore: this.p1Score
            });
            return;
        }

        if (this.currentInnings === 2) {
            const chaserScore = this.isP1Batting ? this.p1Score : this.p2Score;
            if (chaserScore >= this.targetScore || inningsOver) {
                this.endGame();
            }
        }
    }

    endGame() {
        debugLog('Game ending', { 
            gameId: this.gameId, 
            p1Score: this.p1Score, 
            p2Score: this.p2Score 
        });

        let p1Name = this.p1.username || "Player 1";
        let p2Name = this.p2.username || "Player 2";
        
        let p1Won = false;
        let p2Won = false;
        
        if (this.p1Score > this.p2Score) {
            p1Won = true;
        } else if (this.p2Score > this.p1Score) {
            p2Won = true;
        } else {
            p1Won = true;
        }

        // Send personalized game over messages
        this.p1.emit('gameOver', { 
            message: p1Won ? "YOU WIN!" : `${p2Name} Wins!`,
            winnerName: p1Won ? "YOU" : p2Name,
            yourScore: this.p1Score,
            opponentScore: this.p2Score,
            yourWickets: this.p1Wickets,
            opponentWickets: this.p2Wickets
        });
        
        this.p2.emit('gameOver', { 
            message: p2Won ? "YOU WIN!" : `${p1Name} Wins!`,
            winnerName: p2Won ? "YOU" : p1Name,
            yourScore: this.p2Score,
            opponentScore: this.p1Score,
            yourWickets: this.p2Wickets,
            opponentWickets: this.p1Wickets
        });

        if (this.tournament) {
            const winnerSocket = p1Won ? this.p1 : this.p2;
            debugLog('Reporting tournament winner', { 
                tournament: this.tournament.lobbyId, 
                winner: winnerSocket.username || winnerSocket.id 
            });
            this.tournament.reportWinner(winnerSocket, this.p1Won ? this.p2 : this.p1);
        }

        // Clean up after tournament processing
        setTimeout(() => {
            delete games[this.gameId];
            debugLog('Game cleaned up', { gameId: this.gameId });
        }, 100);
    }
}

// --- Tournament Class ---
class Tournament {
    constructor(lobbyId, players) {
        this.lobbyId = lobbyId;
        this.players = players;
        this.size = players.length;
        this.round = 1;
        this.bracket = [];
        this.winners = [];
        this.activeGames = new Set();
        
        debugLog('Tournament created', { 
            lobbyId: lobbyId, 
            playerCount: players.length 
        });
    }
    
    start() {
        debugLog('Tournament starting', { lobbyId: this.lobbyId });
        this.players = this.players.sort(() => Math.random() - 0.5);
        
        let matches = [];
        for (let i = 0; i < this.players.length; i += 2) {
            if (this.players[i + 1]) {
                matches.push({
                    p1: this.players[i],
                    p2: this.players[i + 1],
                    winner: null,
                    gameId: null
                });
            }
        }
        this.bracket.push(matches);

        this.broadcastBracket();

        setTimeout(() => {
            this.startRoundMatches(matches, 1);
        }, 3000); 
    }

    startRoundMatches(matches, roundNumber) {
        debugLog(`Starting round ${roundNumber} matches`, { matchCount: matches.length });
        
        matches.forEach((match, index) => {
            const matchId = `R${roundNumber}-M${index}`;
            this.createGame(match.p1, match.p2, matchId, match);
        });
    }

    createGame(p1, p2, matchId, match) {
        const gameRoomId = `${this.lobbyId}-${matchId}`;
        
        debugLog('Creating tournament game', { 
            gameRoomId, 
            p1: p1.username || p1.id, 
            p2: p2.username || p2.id 
        });
        
        match.gameId = gameRoomId;
        this.activeGames.add(gameRoomId);
        
        p1.join(gameRoomId);
        p2.join(gameRoomId);
        
        const game = new Game(p1, p2, gameRoomId, this);
        games[gameRoomId] = game;
        
        setTimeout(() => {
            if (games[gameRoomId]) {
                game.startToss();
            }
        }, 1000);
    }
    
    reportWinner(winnerSocket, loserSocket) {
        if (!validateSocket(winnerSocket)) {
            debugLog('Invalid winner socket');
            return;
        }

        debugLog('Tournament winner reported', { 
            lobbyId: this.lobbyId, 
            winner: winnerSocket.username || winnerSocket.id,
            round: this.round
        });
        
        let currentRoundMatches = this.bracket[this.round - 1];
        let matchFound = false;
        
        for (let match of currentRoundMatches) {
            if ((match.p1.id === winnerSocket.id || match.p2.id === winnerSocket.id) && !match.winner) {
                match.winner = winnerSocket;
                matchFound = true;
                
                if (match.gameId) {
                    this.activeGames.delete(match.gameId);
                }
                break;
            }
        }
        
        if (!matchFound) {
            debugLog('Warning: Could not find match for winner', { winner: winnerSocket.id });
            return;
        }
        
        this.broadcastBracket();

        // Check if all matches in current round are complete
        const allMatchesComplete = currentRoundMatches.every(match => match.winner !== null);
        const noActiveGames = this.activeGames.size === 0;
        
        debugLog('Round completion check', {
            round: this.round,
            allMatchesComplete,
            noActiveGames,
            totalMatches: currentRoundMatches.length,
            completedMatches: currentRoundMatches.filter(m => m.winner).length
        });
        
        if (allMatchesComplete && noActiveGames) {
            const winners = currentRoundMatches.map(match => match.winner).filter(winner => winner);
            
            if (winners.length === 1) {
                this.crownChampion(winners[0]);
            } else {
                this.startNextRound(winners);
            }
        }
    }

    startNextRound(winners) {
        this.round++;
        debugLog('Starting next tournament round', { 
            lobbyId: this.lobbyId, 
            round: this.round,
            winnersCount: winners.length
        });
        
        let matches = [];
        for (let i = 0; i < winners.length; i += 2) {
            if (winners[i + 1]) {
                matches.push({
                    p1: winners[i],
                    p2: winners[i + 1],
                    winner: null,
                    gameId: null
                });
            }
        }
        
        this.bracket.push(matches);
        this.broadcastBracket();

        setTimeout(() => {
            this.startRoundMatches(matches, this.round);
        }, 3000);
    }

    crownChampion(championSocket) {
        if (!validateSocket(championSocket)) {
            debugLog('Invalid champion socket');
            return;
        }

        debugLog('Tournament champion crowned', { 
            lobbyId: this.lobbyId, 
            champion: championSocket.username || championSocket.id 
        });
        
        io.to(this.lobbyId).emit('tournamentWinner', { 
            name: championSocket.username || championSocket.id,
            championId: championSocket.id
        });
        
        delete activeTournaments[this.lobbyId];
    }
    
    getBracketData() {
        return this.bracket.map(round => {
            return round.map(match => {
                return {
                    p1: match.p1.id,
                    p2: match.p2.id,
                    p1Name: match.p1.username || `Player ${match.p1.id.substring(0, 5)}`,
                    p2Name: match.p2.username || `Player ${match.p2.id.substring(0, 5)}`,
                    winner: match.winner ? match.winner.id : null,
                    winnerName: match.winner ? (match.winner.username || `Player ${match.winner.id.substring(0, 5)}`) : null,
                    gameId: match.gameId
                };
            });
        });
    }

    broadcastBracket() {
        const bracketData = this.getBracketData();
        debugLog('Broadcasting bracket update', { 
            lobbyId: this.lobbyId, 
            round: this.round
        });
        io.to(this.lobbyId).emit('tournamentBracketUpdate', bracketData);
    }
}

// --- Helper function for lobby updates ---
function broadcastLobbyUpdate(lobbyId) {
    const lobby = tournamentLobbies[lobbyId];
    if (!lobby) return;
    
    const playerData = lobby.players.map(p => ({
        id: p.id,
        username: p.username || `Player ${p.id.substring(0, 5)}`
    }));
    
    const data = {
        lobbyId: lobbyId,
        players: playerData,
        count: lobby.players.length,
        size: lobby.size,
        host: lobby.host
    };
    io.to(lobbyId).emit('tournamentLobbyUpdate', data);
}

// --- Socket.io Connection Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.currentLobbyId = null;
    socket.username = null;

    // --- Username Setup ---
    socket.on('setUsername', (username) => {
        if (username && username.trim().length > 0) {
            socket.username = username.trim().substring(0, 15);
            console.log(`User ${socket.id} set username to: ${socket.username}`);
            socket.emit('usernameSet', { success: true, username: socket.username });
        } else {
            socket.emit('usernameSet', { success: false, error: 'Invalid username' });
        }
    });

    // --- 1v1 Room Logic ---
    socket.on('createRoom', () => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = socket;
        socket.join(roomId);
        console.log('Room created:', roomId, 'by', socket.username || socket.id);
        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId) => {
        const p1 = rooms[roomId];
        if (!p1) return socket.emit('errorMsg', 'Room not found.');
        if (p1.id === socket.id) return;

        const p2 = socket;
        p2.join(roomId);
        console.log((p2.username || p2.id), 'joined room:', roomId);

        const newGame = new Game(p1, p2, roomId);
        games[roomId] = newGame;
        newGame.startToss();
        
        delete rooms[roomId];
    });

    // --- Tournament Lobby Logic ---
    socket.on('createTournamentLobby', (data) => {
        const size = data.size;
        if (![4, 8, 16].includes(size)) {
            return socket.emit('tournamentError', 'Invalid tournament size.');
        }

        const lobbyId = "T-" + Math.random().toString(36).substring(2, 7).toUpperCase();
        
        tournamentLobbies[lobbyId] = {
            players: [socket],
            size: size,
            host: socket.id
        };
        socket.join(lobbyId);
        socket.currentLobbyId = lobbyId;
        console.log(`${size}-player lobby created:`, lobbyId, 'by', socket.username || socket.id);
        
        socket.emit('tournamentLobbyCreated', lobbyId);
        broadcastLobbyUpdate(lobbyId);
    });

    socket.on('joinTournamentLobby', (lobbyId) => {
        const lobby = tournamentLobbies[lobbyId];

        if (!lobby) {
            return socket.emit('tournamentError', 'Lobby not found.');
        }
        if (lobby.players.length >= lobby.size) {
            return socket.emit('tournamentError', 'Lobby is full.');
        }

        lobby.players.push(socket);
        socket.join(lobbyId);
        socket.currentLobbyId = lobbyId;
        console.log('Player joined lobby:', lobbyId, socket.username || socket.id);

        socket.emit('tournamentLobbyJoined', lobbyId);
        broadcastLobbyUpdate(lobbyId);

        if (lobby.players.length === lobby.size) {
            console.log(`Lobby ${lobbyId} FULL! Starting tournament...`);
            const newTournament = new Tournament(lobbyId, lobby.players);
            activeTournaments[lobbyId] = newTournament;
            newTournament.start();
            
            delete tournamentLobbies[lobbyId];
        }
    });

    socket.on('leaveTournamentLobby', () => {
        const lobbyId = socket.currentLobbyId;
        if (!lobbyId || !tournamentLobbies[lobbyId]) return;

        const lobby = tournamentLobbies[lobbyId];
        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        socket.leave(lobbyId);
        socket.currentLobbyId = null;
        
        console.log('Player left lobby:', lobbyId, socket.username || socket.id);

        if (lobby.host === socket.id && lobby.players.length > 0) {
            console.log(`Host left lobby ${lobbyId}. Kicking players.`);
            io.to(lobbyId).emit('tournamentError', 'The host disconnected. Lobby closed.');
            lobby.players.forEach(p => {
                p.leave(lobbyId);
                p.currentLobbyId = null;
            });
            delete tournamentLobbies[lobbyId];
        } else if (lobby.players.length === 0) {
            delete tournamentLobbies[lobbyId];
        } else {
            broadcastLobbyUpdate(lobbyId);
        }
    });
    
    // --- Shared Game Logic Handlers ---
    socket.on('tossChoice', (choice) => {
        if (!validateSocket(socket)) return;
        debugLog('Toss choice received', { socket: socket.username || socket.id, choice });
        const game = games[socket.gameId];
        if (game) game.handleTossChoice(choice);
    });
    
    socket.on('batBowlChoice', (choice) => {
        if (!validateSocket(socket)) return;
        debugLog('Bat/bowl choice received', { socket: socket.username || socket.id, choice });
        const game = games[socket.gameId];
        if (game) game.handleBatBowlChoice(socket, choice);
    });

    socket.on('playerThrow', (data) => {
        if (!validateSocket(socket)) {
            debugLog('Invalid socket for playerThrow', { socket: socket.id });
            return;
        }
        debugLog('Player throw received', { socket: socket.username || socket.id, throw: data.throw });
        const game = games[socket.gameId];
        if (game) {
            game.handleThrow(socket, data.throw);
        } else {
            console.error(`ERROR: No game found for socket ${socket.id}`);
            socket.emit('errorMsg', 'Game not found. Please restart.');
        }
    });
    
    // --- Disconnect Logic ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.username || socket.id);
        
        // 1v1 Room Disconnect
        for (const roomId in rooms) {
            if (rooms[roomId].id === socket.id) {
                delete rooms[roomId];
                console.log('Deleted open room:', roomId);
            }
        }
        
        // Tournament Lobby Disconnect
        const lobbyId = socket.currentLobbyId;
        if (lobbyId && tournamentLobbies[lobbyId]) {
            const lobby = tournamentLobbies[lobbyId];
            lobby.players = lobby.players.filter(p => p.id !== socket.id);
            console.log('Player removed from tournament lobby:', lobbyId, socket.username || socket.id);

            if (lobby.host === socket.id && lobby.players.length > 0) {
                console.log(`Host disconnected from lobby ${lobbyId}. Kicking players.`);
                io.to(lobbyId).emit('tournamentError', 'The host disconnected. Lobby closed.');
                lobby.players.forEach(p => {
                    p.leave(lobbyId);
                    p.currentLobbyId = null;
                });
                delete tournamentLobbies[lobbyId];
            } else if (lobby.players.length === 0) {
                delete tournamentLobbies[lobbyId];
            } else {
                broadcastLobbyUpdate(lobbyId);
            }
        }

        // Active Tournament Game Disconnect
        for (const lobbyId in activeTournaments) {
            const tournament = activeTournaments[lobbyId];
            for (const gameId of tournament.activeGames) {
                const game = games[gameId];
                if (game && (game.p1.id === socket.id || game.p2.id === socket.id)) {
                    const opponent = (socket.id === game.p1.id) ? game.p2 : game.p1;
                    if (validateSocket(opponent)) {
                        opponent.emit('opponentDisconnected');
                        tournament.reportWinner(opponent, socket);
                    }
                    break;
                }
            }
        }

        // Active Game Disconnect (non-tournament)
        const game = games[socket.gameId];
        if (game && !game.tournament) {
            const opponent = (socket.id === game.p1.id) ? game.p2 : game.p1;
            if (validateSocket(opponent)) {
                opponent.emit('opponentDisconnected');
            }
            delete games[socket.gameId];
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running! Open http://localhost:${PORT} in your browser.`);
});