import React, { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GameState, Player, Answer, Vote, ChatMessage, QuestionSource } from '../types';
import { LobbyScreen } from './LobbyScreen';
import { SetupScreen } from './SetupScreen';
import { RoleRevealScreen } from './RoleRevealScreen';
import { AnsweringScreen } from './AnsweringScreen';
import { ResultsDiscussionScreen } from './ResultsDiscussionScreen';
import { VoteRevealScreen } from './VoteRevealScreen';
import { GameOverScreen } from './GameOverScreen';
import { LoadingScreen } from './LoadingScreen';
import { generateId, checkWinConditions, generateNewQuestion } from '../utils';
import { Chat } from './Chat';
import { db } from '../firebase';
import { ref, onValue, off, set, update, remove, transaction, serverTimestamp } from 'firebase/database';
import { DebugMenu } from './DebugMenu';
import { NextRoundSyncScreen } from './NextRoundSyncScreen';

export interface OnlineGameHandle {
  cleanup: () => void;
}

interface OnlineGameProps {
    onExit: () => void;
    initialRoomId: string | null;
    isDebugMenuOpen: boolean;
    closeDebugMenu: () => void;
}

export const OnlineGame = forwardRef<OnlineGameHandle, OnlineGameProps>(({ onExit, initialRoomId, isDebugMenuOpen, closeDebugMenu }, ref) => {
    const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberedRoomId, setRememberedRoomId] = useState<string | null>(initialRoomId);
    const [forcedSpies, setForcedSpies] = useState<Set<string>>(new Set());

    const isExitingRef = useRef(false);
    const gameStateUnsubscribeRef = useRef<(() => void) | null>(null);

    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;
    const localPlayerIdRef = useRef(localPlayerId);
    localPlayerIdRef.current = localPlayerId;

    const isHost = gameState?.hostId === localPlayerId;
    const playerList = useMemo(() => {
        if (!gameState) return [];
        const players = Object.values(gameState.players);
        players.sort((a: Player, b: Player) => {
            if (a.isHost) return -1;
            if (b.isHost) return 1;
            return (a.joinTimestamp || 0) - (b.joinTimestamp || 0);
        });
        return players;
    }, [gameState]);
    const localPlayer = useMemo(() => (localPlayerId && gameState?.players ? gameState.players[localPlayerId] : null), [gameState, localPlayerId]);
    const activePlayers = useMemo(() => playerList.filter(p => !p.isEliminated), [playerList]);
    
    const chatMessages = useMemo(() => {
        if (!gameState?.chatMessages) return [];
        return Array.isArray(gameState.chatMessages) ? gameState.chatMessages : Object.values(gameState.chatMessages);
    }, [gameState?.chatMessages]);
    
    // Get remembered room ID from URL or localStorage to pre-fill lobby input
    useEffect(() => {
        if (initialRoomId) {
            setRememberedRoomId(initialRoomId);
            return;
        }

        const savedSessionRaw = localStorage.getItem('spy-game-session');
        if (savedSessionRaw) {
            try {
                const { roomId } = JSON.parse(savedSessionRaw);
                if (roomId) {
                    setRememberedRoomId(roomId);
                }
            } catch (e) {
                console.error("Failed to parse session", e);
                localStorage.removeItem('spy-game-session');
            }
        }
    }, [initialRoomId]);


    const subscribeToGameState = useCallback((roomId: string, playerId: string) => {
        const roomRef = ref(db, `rooms/${roomId}`);
        const onValueCallback = (snapshot: firebase.database.DataSnapshot) => {
            if (isExitingRef.current) return;
    
            const data = snapshot.val();
            if (data) {
                if (data.players && !data.players[playerId] && data.gamePhase !== 'GAME_OVER') {
                     setError("Вы были исключены из комнаты или игра завершилась.");
                     localStorage.removeItem('spy-game-session');
                     return;
                }
    
                const sanitizedData: GameState = {
                    ...data,
                    answers: data.answers || [],
                    votes: data.votes || [],
                    usedQuestionIds: data.usedQuestionIds || [],
                    usedQuestionTexts: data.usedQuestionTexts || [],
                    players: data.players || {},
                    chatMessages: data.chatMessages || [],
                };
                setGameState(sanitizedData);
            } else {
                if (gameStateRef.current) {
                    setError("Комната была удалена, или последний игрок вышел.");
                    localStorage.removeItem('spy-game-session');
                }
            }
        };
        roomRef.on('value', onValueCallback);
        gameStateUnsubscribeRef.current = () => roomRef.off('value', onValueCallback);
    }, []);

    // Manages connection status for the current player
    useEffect(() => {
        if (gameState?.roomId && localPlayerId) {
            const playerRef = ref(db, `rooms/${gameState.roomId}/players/${localPlayerId}`);
            const connectedRef = ref(db, '.info/connected');

            const listener = connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    playerRef.onDisconnect().remove(err => {
                        if (err) console.error("onDisconnect failed to set up:", err);
                    });
                    playerRef.update({ connectionStatus: 'connected' }).catch(e => console.error("Firebase set status error:", e));
                }
            });

            return () => {
                connectedRef.off('value', listener);
            };
        }
    }, [gameState?.roomId, localPlayerId]);

    // Cleanup function for explicit exit
    const handleLeaveRoom = useCallback((shouldCallOnExit: boolean = true) => {
        if (isExitingRef.current) return;
        isExitingRef.current = true;

        if (gameStateUnsubscribeRef.current) {
            gameStateUnsubscribeRef.current();
            gameStateUnsubscribeRef.current = null;
        }

        localStorage.removeItem('spy-game-session');

        const roomId = gameStateRef.current?.roomId;
        const currentLocalPlayerId = localPlayerIdRef.current;

        if (roomId && currentLocalPlayerId) {
            const playerRef = ref(db, `rooms/${roomId}/players/${currentLocalPlayerId}`);
            playerRef.onDisconnect().cancel(); // Cancel the onDisconnect handler

            const roomRef = ref(db, `rooms/${roomId}`);
            roomRef.transaction((currentRoomState: GameState | null) => {
                if (!currentRoomState || !currentRoomState.players || !currentRoomState.players[currentLocalPlayerId]) {
                    return currentRoomState;
                }
                const isLeavingPlayerHost = currentRoomState.hostId === currentLocalPlayerId;
                delete currentRoomState.players[currentLocalPlayerId];
                const remainingPlayers = Object.values(currentRoomState.players);

                if (remainingPlayers.length === 0) return null;

                if (isLeavingPlayerHost) {
                    const nextHost = remainingPlayers.sort((a: Player, b: Player) => (a.joinTimestamp || 0) - (b.joinTimestamp || 0))[0];
                    currentRoomState.hostId = nextHost.id;
                    if (currentRoomState.players[nextHost.id]) {
                        currentRoomState.players[nextHost.id].isHost = true;
                    }
                }
                return currentRoomState;
            }).catch(e => console.error("Failed to leave room", e));
        }
        if (shouldCallOnExit) {
            onExit();
        }
    }, [onExit]);

    useImperativeHandle(ref, () => ({
        cleanup: () => handleLeaveRoom(false),
    }));
    
    useEffect(() => {
        return () => {
            if (gameStateUnsubscribeRef.current) {
                gameStateUnsubscribeRef.current();
            }
        };
    }, []);

    const updateGameState = useCallback((newState: Partial<GameState>) => {
        if (isHost && gameState?.roomId) {
            transaction(ref(db, `rooms/${gameState.roomId}`), (currentState) => {
                if (currentState) {
                    return { ...currentState, ...newState };
                }
                return currentState;
            }).catch(e => console.error("Update game state failed:", e));
        }
    }, [isHost, gameState?.roomId]);
    
    const handleCreateRoom = async (playerName: string, avatar: string | null) => {
        isExitingRef.current = false;
        setIsLoading(true);
        setError(null);
        
        // --- Database Cleanup ---
        try {
            const allRoomsRef = ref(db, 'rooms');
            const snapshot = await get(allRoomsRef);
            if (snapshot.exists()) {
                const allRooms = snapshot.val();
                const updates: { [key: string]: null } = {};
                for (const roomId in allRooms) {
                    const room = allRooms[roomId];
                    const players = room.players ? Object.values(room.players) : [];
                    if (players.length === 0) {
                        updates[`/rooms/${roomId}`] = null;
                    }
                }
                if (Object.keys(updates).length > 0) {
                    await update(ref(db), updates);
                }
            }
        } catch (e) {
            console.warn("Cleanup script failed:", e);
        }
        // --- End Cleanup ---

        const playerId = generateId();
        const roomId = generateId();

        const hostPlayer: Player = { id: playerId, name: playerName, avatar, isSpy: false, isEliminated: false, isHost: true, connectionStatus: 'connected', joinTimestamp: serverTimestamp() as any };
        const initialState: GameState = {
            roomId, hostId: playerId, gamePhase: 'SETUP', players: { [playerId]: hostPlayer },
            initialSpyCount: 1, votingEnabled: true, questionSource: 'library', familyFriendly: true,
            noTimer: false, roundLimit: true, showQuestionToSpy: true, anonymousVoting: false,
            round: 1, usedQuestionIds: [], usedQuestionTexts: [], currentQuestion: null,
            answers: [], votes: [], chatMessages: [], lastEliminated: null, winner: null, answerTimerEnd: null, voteTimerEnd: null,
        };
        
        try {
            await set(ref(db, `rooms/${roomId}`), initialState);
            setLocalPlayerId(playerId);
            subscribeToGameState(roomId, playerId);
            localStorage.setItem('spy-game-session', JSON.stringify({ roomId, playerId }));
        } catch (e) {
            console.error("Failed to create room: ", e);
            setError("Не удалось создать комнату.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleJoinRoom = async (playerName: string, roomId: string, avatar: string | null) => {
        isExitingRef.current = false;
        setIsLoading(true);
        setError(null);
        const upperRoomId = roomId.toUpperCase();
        const roomRef = ref(db, `rooms/${upperRoomId}`);
    
        try {
            const snapshot = await get(roomRef);
            if (!snapshot.exists()) {
                setError('Комната не найдена. Проверьте код.');
                return;
            }
    
            const roomState: GameState = snapshot.val();

            // --- GHOST ROOM CLEANUP ---
            const playersInRoom = roomState.players ? Object.values(roomState.players) : [];
            if (playersInRoom.length === 0) {
                await remove(roomRef);
                setError('Комната не найдена (была пуста и удалена).');
                return;
            }
            // --- END GHOST ROOM CLEANUP ---

            const players = Object.values(roomState.players || {}) as Player[];
    
            // Rejoin Logic (check for disconnected players with the same name)
            const disconnectedPlayer = players.find(p => p.name === playerName && p.connectionStatus === 'disconnected');
    
            if (disconnectedPlayer) {
                const playerId = disconnectedPlayer.id;
    
                const updates: { [key: string]: any } = {};
                if (disconnectedPlayer.avatar !== avatar) {
                    updates[`players/${playerId}/avatar`] = avatar;
                }
    
                await update(roomRef, updates); // Only update avatar if needed, status will be set by the main connection logic
    
                setLocalPlayerId(playerId);
                subscribeToGameState(upperRoomId, playerId);
                localStorage.setItem('spy-game-session', JSON.stringify({ roomId: upperRoomId, playerId }));
                return;
            }
    
            // --- New Player Join Logic ---
            if (players.some(p => p.name === playerName)) {
                setError('Игрок с таким именем уже в комнате.');
                return;
            }
    
            if (roomState.gamePhase !== 'SETUP') {
                setError('Игра уже началась. Вы не можете присоединиться.');
                return;
            }
            
            if (players.length >= 12) {
                setError('Комната заполнена.');
                return;
            }
    
            const playerId = generateId();
            const newPlayer: Player = { id: playerId, name: playerName, avatar, isSpy: false, isEliminated: false, isHost: false, connectionStatus: 'connected', joinTimestamp: serverTimestamp() as any };
            const playerRef = ref(db, `rooms/${upperRoomId}/players/${playerId}`);
            await set(playerRef, newPlayer);
    
            setLocalPlayerId(playerId);
            subscribeToGameState(upperRoomId, playerId);
            localStorage.setItem('spy-game-session', JSON.stringify({ roomId: upperRoomId, playerId }));
    
        } catch (e) {
            console.error("Failed to join room: ", e);
            setError("Не удалось присоединиться к комнате. Проверьте соединение.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransferHost = (newHostId: string) => {
        if (!isHost || !gameState?.roomId || !localPlayerId) return;
        const roomRef = ref(db, `rooms/${gameState.roomId}`);
        update(roomRef, {
            hostId: newHostId,
            [`players/${newHostId}/isHost`]: true,
            [`players/${localPlayerId}/isHost`]: false,
        }).catch(e => console.error("Failed to transfer host:", e));
    };

    const startNewRound = useCallback(async (baseState?: GameState) => {
        const currentState = baseState || gameState;
        if (!isHost || !currentState) return;
        setIsGenerating(true);
    
        const { newQuestion, usedQuestionIds, usedQuestionTexts, error } = await generateNewQuestion(currentState);
        if (error) console.warn(error);
    
        let updateData: Partial<GameState> = {};
        if (newQuestion) {
            let questionWithDynamicAnswers = { ...newQuestion };
            if (questionWithDynamicAnswers.type === 'PLAYERS') {
                questionWithDynamicAnswers.answers = Object.values(currentState.players).filter((p: Player) => !p.isEliminated).map((p: Player) => p.name);
            }
            updateData = {
                round: currentState.round,
                currentQuestion: questionWithDynamicAnswers,
                usedQuestionIds,
                usedQuestionTexts,
                answers: [],
                votes: [],
                lastEliminated: null,
                gamePhase: 'ANSWERING',
                answerTimerEnd: currentState.noTimer ? null : Date.now() + 30000,
            };
        } else {
            updateData = { winner: 'PLAYERS', gamePhase: 'GAME_OVER' };
        }
        
        setIsGenerating(false);
        updateGameState(updateData);
    }, [isHost, gameState, updateGameState]);

    const handleVoteTally = useCallback(() => {
        if (!isHost || !gameState || gameState.gamePhase !== 'RESULTS_DISCUSSION') return;
        
        const currentActivePlayers = Object.values(gameState.players).filter((p: Player) => !p.isEliminated);
        const requiredVotes = Math.ceil(currentActivePlayers.length / 2);
        const actualVotes = gameState.votes.filter(v => v.votedForId !== null);
        const voteCounts: Record<string, number> = {};
        actualVotes.forEach(vote => { voteCounts[vote.votedForId!] = (voteCounts[vote.votedForId!] || 0) + 1; });

        let maxVotes = 0, playersToEliminate: string[] = [];
        for (const playerId in voteCounts) {
            if (voteCounts[playerId] > maxVotes) {
                maxVotes = voteCounts[playerId];
                playersToEliminate = [playerId];
            } else if (voteCounts[playerId] === maxVotes) {
                playersToEliminate.push(playerId);
            }
        }

        let eliminatedPlayer: Player | null = null;
        let newPlayers = { ...gameState.players };
        if (playersToEliminate.length === 1 && maxVotes >= requiredVotes) {
            const eliminatedId = playersToEliminate[0];
            newPlayers[eliminatedId] = { ...newPlayers[eliminatedId], isEliminated: true };
            eliminatedPlayer = gameState.players[eliminatedId] || null;
        }

        updateGameState({ players: newPlayers, lastEliminated: eliminatedPlayer, voteTimerEnd: null, gamePhase: 'VOTE_REVEAL' });
    }, [isHost, gameState, updateGameState]);

    // Host-side useEffects for phase transitions
    useEffect(() => {
        if (!isHost || !gameState || gameState.noTimer) return;
        let timer: number | undefined;

        if (gameState.gamePhase === 'ANSWERING' && gameState.answerTimerEnd) {
            const delay = gameState.answerTimerEnd - Date.now();
            timer = window.setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'ANSWERING') {
                    updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: gameState.noTimer ? null : Date.now() + activePlayers.length * 10000 });
                }
            }, Math.max(0, delay));
        } else if (gameState.gamePhase === 'RESULTS_DISCUSSION' && gameState.voteTimerEnd) {
            const delay = gameState.voteTimerEnd - Date.now();
            timer = window.setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'RESULTS_DISCUSSION') {
                    handleVoteTally();
                }
            }, Math.max(0, delay));
        }
        return () => clearTimeout(timer);
    }, [isHost, gameState, activePlayers.length, handleVoteTally, updateGameState]);

    // Auto-progress when all connected players have answered
    useEffect(() => {
        if (!isHost || !gameState || gameState.gamePhase !== 'ANSWERING') {
            return;
        }

        const connectedActivePlayers = activePlayers.filter(p => p.connectionStatus === 'connected');
        if (connectedActivePlayers.length === 0) return;

        const answeredPlayerIds = new Set(gameState.answers.map(a => a.playerId));
        const allConnectedAnswered = connectedActivePlayers.every(p => answeredPlayerIds.has(p.id));

        if (allConnectedAnswered) {
             const timer = setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'ANSWERING') {
                   updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: gameState.noTimer ? null : Date.now() + activePlayers.length * 10000 });
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isHost, gameState, activePlayers, updateGameState]);

    // Auto-progress when all connected players have voted
    useEffect(() => {
        if (isHost && gameState?.gamePhase === 'RESULTS_DISCUSSION' && gameState.votingEnabled) {
            const connectedActivePlayers = activePlayers.filter(p => p.connectionStatus === 'connected');
            if (connectedActivePlayers.length > 0 && gameState.votes.length >= connectedActivePlayers.length) {
                handleVoteTally();
            }
        }
    }, [isHost, gameState, activePlayers, handleVoteTally]);

    useEffect(() => {
        if (isHost && gameState?.gamePhase === 'ROLE_REVEAL') {
            const allAcknowledged = Object.values(gameState.players).every((p: Player) => p.roleAcknowledged || p.isEliminated || p.connectionStatus === 'disconnected');
            if (allAcknowledged) {
                const timer = setTimeout(() => updateGameState({ gamePhase: 'SYNCING_NEXT_ROUND' }), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [isHost, gameState, updateGameState]);

    const handleAction = (path: string, value: any, condition?: (currentData: any) => boolean) => {
        if (!gameState?.roomId || !localPlayerId) return;
        const actionRef = ref(db, `rooms/${gameState.roomId}/${path}`);
        transaction(actionRef, (currentData) => {
            if(condition && condition(currentData)) {
                return; // Abort transaction
            }
            if (Array.isArray(currentData)) {
                return [...currentData, value];
            }
            return [value];
        }).catch(e => console.error(`Transaction failed for ${path}`, e));
    };
    
    const handleGameStart = (spyCount: number, source: QuestionSource, familyMode: boolean) => {
        if (!isHost || !gameState) return;

        const playerList = Object.values({ ...gameState.players }) as Player[];
        const playerIds = playerList.map(p => p.id);

        const spyIds = new Set<string>(forcedSpies);
        const spiesToPick = spyCount - spyIds.size;

        if (spiesToPick > 0) {
            const candidates = playerIds.filter(id => !spyIds.has(id));
            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            for (let i = 0; i < spiesToPick && i < candidates.length; i++) {
                spyIds.add(candidates[i]);
            }
        }

        const newPlayers = { ...gameState.players };
        Object.keys(newPlayers).forEach(id => {
            newPlayers[id] = { ...newPlayers[id], isSpy: spyIds.has(id), roleAcknowledged: false };
        });
        
        setForcedSpies(new Set());

        updateGameState({ players: newPlayers, initialSpyCount: spyCount, questionSource: source, familyFriendly: familyMode, gamePhase: 'ROLE_REVEAL' });
    };

    const handleAcknowledgeRole = () => {
        if (!gameState?.roomId || !localPlayerId) return;
        set(ref(db, `rooms/${gameState.roomId}/players/${localPlayerId}/roleAcknowledged`), true)
            .catch(e => console.error("Firebase set roleAcknowledged error:", e));
    };

    const handleRoleRevealContinue = () => {
        if (!isHost || !gameState) return;
        const allAcknowledged = Object.values(gameState.players).every((p: Player) => p.roleAcknowledged || p.isEliminated || p.connectionStatus === 'disconnected');

        if (allAcknowledged) {
            updateGameState({ gamePhase: 'SYNCING_NEXT_ROUND' });
        } else {
            startNewRound(gameState);
        }
    };

    const handleAnswerSubmit = (answer: string) => handleAction('answers', { playerId: localPlayerId, answer }, 
        (current) => current?.some((a: Answer) => a.playerId === localPlayerId));

    const handleVoteSubmit = (votedForId: string | null) => handleAction('votes', { voterId: localPlayerId, votedForId },
        (current) => current?.some((v: Vote) => v.voterId === localPlayerId));

    const handleVoteRevealFinished = async () => {
        if (!isHost || !gameState) return;
        const winner = checkWinConditions(Object.values(gameState.players));
        const initialPlayerCount = Object.keys(gameState.players).length;
        if (winner || (gameState.roundLimit && gameState.round >= initialPlayerCount - 1)) {
            updateGameState({ winner: winner || 'SPIES', gamePhase: 'GAME_OVER' });
        } else {
            const newPlayers = { ...gameState.players };
            Object.keys(newPlayers).forEach(id => newPlayers[id].readyForNextRound = false);
            updateGameState({ players: newPlayers, gamePhase: 'SYNCING_NEXT_ROUND' });
        }
    };
    
    const handleReadyForNextRound = useCallback(() => {
        if (gameState?.roomId && localPlayerId) {
            const playerReadyRef = ref(db, `rooms/${gameState.roomId}/players/${localPlayerId}/readyForNextRound`);
            set(playerReadyRef, true).catch(e => console.error("Firebase set readyForNextRound error:", e));
        }
    }, [gameState?.roomId, localPlayerId]);

    const handleContinueToNextRound = useCallback(() => {
        if (!isHost || !gameState) return;
        const nextRoundState = { ...gameState, round: gameState.round + 1 };
        startNewRound(nextRoundState);
    }, [isHost, gameState, startNewRound]);

    const handleReplay = () => {
        if (!isHost || !gameState) return;
        const newPlayers = { ...gameState.players };
        Object.keys(newPlayers).forEach(id => {
            newPlayers[id] = { 
                ...newPlayers[id], 
                isEliminated: false, 
                isSpy: false, 
                roleAcknowledged: false, 
                readyForNextRound: false 
            };
        });
        
        updateGameState({ 
            players: newPlayers, 
            round: 1, 
            usedQuestionIds: [], 
            usedQuestionTexts: [], 
            currentQuestion: null, 
            answers: [], 
            votes: [], 
            lastEliminated: null, 
            winner: null, 
            gamePhase: 'SETUP' 
        });
    };

    const handleSendMessage = (text: string) => {
        if (!localPlayer || !gameState?.roomId) return;
        const message: ChatMessage = { senderId: localPlayer.id, senderName: localPlayer.name, senderAvatar: localPlayer.avatar || null, text, timestamp: serverTimestamp() as any, status: 'sent' };
        push(ref(db, `rooms/${gameState.roomId}/chatMessages`), message).catch(e => console.error("Failed to send message:", e));
    };

    const handleChatOpen = useCallback(() => {
        if (!gameState?.roomId || !localPlayerId || !gameState.chatMessages || Array.isArray(gameState.chatMessages)) {
            return;
        }

        const chatMessagesRef = ref(db, `rooms/${gameState.roomId}/chatMessages`);
        const updates: { [key: string]: 'read' } = {};

        const messageRecord = gameState.chatMessages as Record<string, ChatMessage>;

        for (const messageKey in messageRecord) {
            const message = messageRecord[messageKey];
            if (message.senderId !== localPlayerId && message.status !== 'read') {
                updates[`${messageKey}/status`] = 'read';
            }
        }
        
        if (Object.keys(updates).length > 0) {
            chatMessagesRef.update(updates).catch(e => console.error("Failed to update chat status:", e));
        }
    }, [gameState, localPlayerId]);
    
    const handleKickPlayer = (playerId: string) => {
        if (isHost && gameState?.roomId) {
            const playerRef = ref(db, `rooms/${gameState.roomId}/players/${playerId}`);
            remove(playerRef).catch(e => console.error("Failed to kick player:", e));
        }
    };

    const handleToggleForceSpy = useCallback((playerId: string) => {
        setForcedSpies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                if (newSet.size < (gameState?.initialSpyCount || 1)) {
                    newSet.add(playerId);
                } else {
                    alert(`Вы можете выбрать не более ${gameState?.initialSpyCount} шпионов.`);
                }
            }
            return newSet;
        });
    }, [gameState?.initialSpyCount]);

    useEffect(() => {
        if (!isHost || !gameState || gameState.gamePhase !== 'SYNCING_NEXT_ROUND') {
            return;
        }

        const activePlayers = Object.values(gameState.players).filter((p: Player) => !p.isEliminated);
        const connectedActivePlayers = activePlayers.filter((p: Player) => p.connectionStatus !== 'disconnected');

        if (connectedActivePlayers.length === 0 && activePlayers.length > 0) {
            return;
        }

        const allConnectedAreReady = connectedActivePlayers.every((p: Player) => p.readyForNextRound);
        const hasDisconnectedPlayers = activePlayers.some((p: Player) => p.connectionStatus === 'disconnected');

        if (allConnectedAreReady && !hasDisconnectedPlayers) {
            const timer = setTimeout(() => {
                handleContinueToNextRound();
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [isHost, gameState, handleContinueToNextRound]);

    if (isLoading) return <LoadingScreen title="Подключение..." />;
    if (error) return <div className="flex flex-col items-center justify-center text-center min-h-[450px]"><h2 className="text-3xl font-bold text-red-500 mb-4">Ошибка</h2><p className="text-slate-300 mb-8">{error}</p><button onClick={() => handleLeaveRoom(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl">Вернуться в меню</button></div>;
    if (!gameState || !localPlayerId) return <LobbyScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} initialRoomId={rememberedRoomId} />;

    const renderGameScreen = () => {
        if (isGenerating) return <LoadingScreen title="ИИ генерирует вопрос..." description="Это может занять несколько секунд." />;

        switch (gameState.gamePhase) {
            case 'SETUP': return <SetupScreen onGameStart={handleGameStart} players={playerList} isHost={isHost} roomId={gameState.roomId!} initialSettings={gameState} onSettingsChange={(s) => updateGameState(s as GameState)} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} forcedSpies={forcedSpies} />;
            case 'ROLE_REVEAL': return <RoleRevealScreen player={localPlayer} onContinue={handleRoleRevealContinue} isHost={isHost} isLocalMode={false} players={playerList} onAcknowledgeRole={handleAcknowledgeRole} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} />;
            case 'SYNCING_NEXT_ROUND': 
                return <NextRoundSyncScreen 
                    players={playerList}
                    localPlayerId={localPlayerId}
                    isHost={isHost}
                    onContinue={handleContinueToNextRound}
                    onReady={handleReadyForNextRound}
                    onKickPlayer={handleKickPlayer}
                    onTransferHost={handleTransferHost}
                />;
            case 'ANSWERING': return <AnsweringScreen player={localPlayer} players={activePlayers} question={gameState.currentQuestion!} answers={gameState.answers} onSubmit={handleAnswerSubmit} timerEnd={gameState.answerTimerEnd} isLocalMode={false} isHost={isHost} noTimer={gameState.noTimer} onForceEndAnswering={() => updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: gameState.noTimer ? null : Date.now() + activePlayers.length * 10000 })} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} showQuestionToSpy={gameState.showQuestionToSpy} />;
            case 'RESULTS_DISCUSSION': return <ResultsDiscussionScreen question={gameState.currentQuestion!} players={playerList} answers={gameState.answers} onVote={handleVoteSubmit} onTally={handleVoteTally} votingEnabled={gameState.votingEnabled} localPlayerId={localPlayerId} votes={gameState.votes} timerEnd={gameState.voteTimerEnd} isHost={isHost} isLocalMode={false} noTimer={gameState.noTimer} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} showQuestionToSpy={gameState.showQuestionToSpy} />;
            case 'VOTE_REVEAL': return <VoteRevealScreen eliminatedPlayer={gameState.lastEliminated} votes={gameState.votes} players={playerList} onContinue={handleVoteRevealFinished} isHost={isHost} isLocalMode={false} anonymousVoting={gameState.anonymousVoting} />;
            case 'GAME_OVER': return <GameOverScreen winner={gameState.winner!} players={playerList} onNewGame={() => handleLeaveRoom(true)} onReplay={handleReplay} isHost={isHost} isLocalMode={false} />;
            default: return <div>Загрузка...</div>;
        }
    };
    
    return (
        <>
            {localPlayer && (gameState.gamePhase === 'SETUP' || gameState.gamePhase === 'ROLE_REVEAL' || !localPlayer.isEliminated) && (
                <Chat localPlayer={localPlayer} messages={chatMessages} onSendMessage={handleSendMessage} onChatOpen={handleChatOpen} />
            )}
            {renderGameScreen()}
            {isDebugMenuOpen && gameState && <DebugMenu gameState={gameState} onClose={closeDebugMenu} forcedSpies={forcedSpies} onToggleForceSpy={handleToggleForceSpy} isHost={isHost} />}
        </>
    );
});