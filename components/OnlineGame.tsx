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
import { generateId, checkWinConditions, generateNewQuestion, generateUuid } from '../utils';
import { Chat } from './Chat';
import { db, ensureUserIsAuthenticated } from '../firebase';
import firebase from 'firebase/app';
import 'firebase/auth';
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
    isKonamiActive: boolean;
}

export const OnlineGame = forwardRef<OnlineGameHandle, OnlineGameProps>(({ onExit, initialRoomId, isDebugMenuOpen, closeDebugMenu, isKonamiActive }, ref) => {
    const [localPlayerId, setLocalPlayerId] = useState<string | null>(null); // This will now be the instanceId
    const [firebaseAuthUid, setFirebaseAuthUid] = useState<string | null>(null); // The actual Firebase auth.uid
    
    // --- State Refactoring ---
    const [players, setPlayers] = useState<Record<string, Omit<Player, 'name' | 'avatar' | 'firebaseAuthUid'>>>({});
    const [playerProfiles, setPlayerProfiles] = useState<Record<string, Pick<Player, 'id' | 'name' | 'avatar' | 'firebaseAuthUid'>>>({});
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [publicGameState, setPublicGameState] = useState<Partial<GameState>>({});
    // --- End State Refactoring ---

    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberedRoomId, setRememberedRoomId] = useState<string | null>(initialRoomId);
    const [forcedSpies, setForcedSpies] = useState<Set<string>>(new Set());
    const [isAuthReady, setIsAuthReady] = useState(false);

    const isExitingRef = useRef(false);
    const gameStateUnsubscribeRef = useRef<(() => void) | null>(null);

    const gameStateRef = useRef(publicGameState);
    gameStateRef.current = publicGameState;
    const localPlayerIdRef = useRef(localPlayerId);
    localPlayerIdRef.current = localPlayerId;
    
    const combinedGameState = useMemo<GameState | null>(() => {
        if (!publicGameState.roomId) return null;
        
        const combinedPlayers: Record<string, Player> = {};
        for (const id in players) {
            if (playerProfiles[id]) {
                combinedPlayers[id] = { ...playerProfiles[id], ...players[id] };
            }
        }

        return {
            ...publicGameState,
            players: combinedPlayers,
            chatMessages,
        } as GameState;
    }, [publicGameState, players, playerProfiles, chatMessages]);

    // Authenticate user on component mount and generate instanceId
    useEffect(() => {
        ensureUserIsAuthenticated()
            .then(user => {
                setFirebaseAuthUid(user.uid);
                setLocalPlayerId(generateUuid()); // Generate a unique ID for this instance
                setIsAuthReady(true);
            })
            .catch(authError => {
                console.error("Authentication failed:", authError);
                setError("Не удалось анонимно войти. Проверьте настройки Firebase или сетевое подключение.");
                setIsAuthReady(true);
            });
    }, []);

    const isHost = publicGameState?.hostId === localPlayerId;
    const playerList = useMemo(() => {
        if (!players || !playerProfiles) return [];
        
        const playerArr: Player[] = Object.keys(players)
            .map(playerId => {
                const profile = playerProfiles[playerId];
                const state = players[playerId];
                if (profile && state) {
                    return { ...profile, ...state };
                }
                return null;
            })
            .filter((p): p is Player => p !== null);

        playerArr.sort((a: Player, b: Player) => {
            if (a.isHost) return -1;
            if (b.isHost) return 1;
            return (a.joinTimestamp || 0) - (b.joinTimestamp || 0);
        });
        return playerArr;
    }, [players, playerProfiles]);
    const localPlayer = useMemo(() => {
        if (!localPlayerId || !players[localPlayerId] || !playerProfiles[localPlayerId]) {
            return null;
        }
        return { ...playerProfiles[localPlayerId], ...players[localPlayerId] };
    }, [players, playerProfiles, localPlayerId]);
    const activePlayers = useMemo(() => playerList.filter(p => !p.isEliminated), [playerList]);
    
    const memoizedChatMessages = useMemo(() => {
        if (!chatMessages) return [];
        return Array.isArray(chatMessages) ? chatMessages : Object.values(chatMessages);
    }, [chatMessages]);
    
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
        const roomRef = db.ref(`rooms/${roomId}`);
        const listeners: { ref: firebase.database.Reference; event: string; callback: (snapshot: firebase.database.DataSnapshot) => void }[] = [];

        // --- Reset local state on new subscription ---
        setPublicGameState({});
        setPlayers({});
        setPlayerProfiles({});
        setChatMessages([]);
        // --- End Reset ---

        const publicRef = roomRef.child('public');
        const publicCallback = (snapshot: firebase.database.DataSnapshot) => {
            if (isExitingRef.current) return;
            const publicData = snapshot.val();
            if (publicData) {
                setPublicGameState(publicData);
            } else {
                // This handles the case where the room is deleted.
                setError("Комната была удалена, или последний игрок вышел.");
                localStorage.removeItem('spy-game-session');
            }
        };
        publicRef.on('value', publicCallback);
        listeners.push({ ref: publicRef, event: 'value', callback: publicCallback });

        const playersRef = roomRef.child('players');
        const playersCallback = (snapshot: firebase.database.DataSnapshot) => {
            if (isExitingRef.current) return;
            const currentPlayers = snapshot.val() || {};
            setPlayers(currentPlayers);
            // This is a crucial check after the player data is loaded.
            if (gameStateRef.current.gamePhase && gameStateRef.current.gamePhase !== 'GAME_OVER' && !currentPlayers[playerId]) {
                setError("Вы были исключены из комнаты или игра завершилась.");
                localStorage.removeItem('spy-game-session');
            }
        };
        playersRef.on('value', playersCallback);
        listeners.push({ ref: playersRef, event: 'value', callback: playersCallback });

        const profilesRef = roomRef.child('playerProfiles');
        const profilesCallback = (snapshot: firebase.database.DataSnapshot) => {
            if (isExitingRef.current) return;
            setPlayerProfiles(snapshot.val() || {});
        };
        profilesRef.on('value', profilesCallback);
        listeners.push({ ref: profilesRef, event: 'value', callback: profilesCallback });

        const chatRef = roomRef.child('chatMessages');
        // Use child_added for chat to only load new messages, drastically reducing data usage.
        const chatCallback = (snapshot: firebase.database.DataSnapshot) => {
            if (isExitingRef.current) return;
            const message = snapshot.val();
            // Assign the Firebase key to the message object so we can update it later (e.g., for 'read' status)
            message.key = snapshot.key; 
            setChatMessages(prevMessages => [...prevMessages, message]);
        };
        chatRef.on('child_added', chatCallback);
        listeners.push({ ref: chatRef, event: 'child_added', callback: chatCallback });
        
        // No longer need a separate room.on('value') check, as the publicRef callback handles room deletion.

        gameStateUnsubscribeRef.current = () => {
            listeners.forEach(({ ref, event, callback }) => ref.off(event, callback));
        };
    }, []);

    useEffect(() => {
        if (publicGameState?.roomId && localPlayerId) {
            const playerRef = db.ref(`rooms/${publicGameState.roomId}/players/${localPlayerId}`);
            const connectedRef = db.ref('.info/connected');

            const listener = connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    playerRef.onDisconnect().update({ connectionStatus: 'disconnected' }, err => {
                        if (err) console.error("onDisconnect failed to set up:", err);
                    });
                    playerRef.update({ connectionStatus: 'connected' }).catch(e => console.error("Firebase set status error:", e));
                }
            });

            return () => {
                connectedRef.off('value', listener);
            };
        }
    }, [publicGameState, localPlayerId]);

    // Host migration logic
    useEffect(() => {
        if (!publicGameState?.roomId || !localPlayerId || isHost) return;

        const hostPlayerState = players[publicGameState.hostId!];
        if (hostPlayerState?.connectionStatus === 'disconnected') {
            console.log(`Host ${publicGameState.hostId} disconnected. Initiating host migration.`);

            const roomRef = db.ref(`rooms/${publicGameState.roomId}`);
            roomRef.transaction((currentRoomData) => {
                if (!currentRoomData || !currentRoomData.public || !currentRoomData.players || !currentRoomData.playerProfiles) {
                    return currentRoomData;
                }

                const disconnectedHostState = currentRoomData.players[currentRoomData.public.hostId];
                if (!disconnectedHostState || disconnectedHostState.connectionStatus !== 'disconnected') {
                    return currentRoomData; // Host is not disconnected, or already migrated
                }

                const remainingPlayers = Object.values(currentRoomData.players)
                    .filter(p => 
                        p.id !== currentRoomData.public.hostId && 
                        p.connectionStatus === 'connected' && 
                        !p.id.startsWith('BOT-')
                    )
                    .sort((a, b) => (a.joinTimestamp || 0) - (b.joinTimestamp || 0));

                if (remainingPlayers.length > 0) {
                    const nextHost = remainingPlayers[0];
                    const oldHostId = currentRoomData.public.hostId;
                    
                    currentRoomData.public.hostId = nextHost.id;
                    if (currentRoomData.players[nextHost.id]) {
                        currentRoomData.players[nextHost.id].isHost = true;
                    }
                    if (currentRoomData.players[oldHostId]) {
                        currentRoomData.players[oldHostId].isHost = false;
                    }
                    console.log(`Host migrated to ${nextHost.id}`);
                } else {
                    console.log("No connected players left to become host. Room might become empty.");
                }
                return currentRoomData;
            }).catch(e => console.error("Failed to perform host migration transaction:", e));
        }
    }, [publicGameState, localPlayerId, isHost, players]);

    // Cleanup function for explicit exit
    const handleLeaveRoom = useCallback((shouldCallOnExit: boolean = true) => {
        if (isExitingRef.current) return;
        isExitingRef.current = true;

        if (gameStateUnsubscribeRef.current) {
            gameStateUnsubscribeRef.current();
            gameStateUnsubscribeRef.current = null;
        }

        localStorage.removeItem('spy-game-session');

        const roomId = publicGameState.roomId;
        const currentLocalPlayerId = localPlayerIdRef.current;

        if (roomId && currentLocalPlayerId) {
            const playerRef = db.ref(`rooms/${roomId}/players/${currentLocalPlayerId}`);
            playerRef.onDisconnect().cancel(); // Cancel the onDisconnect handler

            const roomRef = db.ref(`rooms/${roomId}`);
            roomRef.transaction((currentRoomData) => {
                if (!currentRoomData || !currentRoomData.players || !currentRoomData.players[currentLocalPlayerId] || !currentRoomData.public) {
                    return currentRoomData;
                }
                const isLeavingPlayerHost = currentRoomData.public.hostId === currentLocalPlayerId;
                
                // Mark player as disconnected instead of deleting them
                currentRoomData.players[currentLocalPlayerId].connectionStatus = 'disconnected';

                const remainingConnectedPlayers = Object.values(currentRoomData.players).filter(p => p.connectionStatus === 'connected');

                // If no players remain at all (shouldn't happen with this logic, but for safety)
                if (Object.values(currentRoomData.players).length === 0) return null;

                if (isLeavingPlayerHost) {
                    // Only migrate host if there is a connected player to take over
                    if (remainingConnectedPlayers.length > 0) {
                        const nextHost = remainingConnectedPlayers.sort((a: Player, b: Player) => (a.joinTimestamp || 0) - (b.joinTimestamp || 0))[0];
                        currentRoomData.public.hostId = nextHost.id;
                        currentRoomData.players[nextHost.id].isHost = true;
                        currentRoomData.players[currentLocalPlayerId].isHost = false; // Old host is no longer host
                    }
                    // If no connected players, the host remains disconnected, and the room stays.
                }
                return currentRoomData;
            }).catch(e => console.error("Failed to leave room", e));
        }
        if (shouldCallOnExit) {
            onExit();
        }
    }, [onExit, publicGameState.roomId]);

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

            if (isHost && publicGameState?.roomId) {

                const updates: { [key: string]: any } = {};

                Object.entries(newState).forEach(([key, value]) => {

                    if (['players', 'chatMessages'].includes(key)) {

                        updates[`/${key}`] = value;

                    } else {

                        updates[`/public/${key}`] = value;

                    }

                });

                updates['/public/lastActivityTimestamp'] = firebase.database.ServerValue.TIMESTAMP;

                db.ref(`rooms/${publicGameState.roomId}`).update(updates).catch(e => console.error("Update game state failed:", e));

            }

        }, [isHost, publicGameState?.roomId]);

        

        const handleCreateRoom = async (playerName: string, avatar: string | null) => {

            isExitingRef.current = false;

            setIsLoading(true);

            setError(null);

            

            // --- Database Garbage Collection ---

            try {

                const isConnected = (await db.ref('.info/connected').get()).val();

                if (isConnected) {

                    const allRoomsRef = db.ref('rooms');

                    const snapshot = await allRoomsRef.get();

                    if (snapshot.exists()) {

                        const allRooms = snapshot.val();

                        const updates: { [key: string]: null } = {};

                        const oneHourAgo = Date.now() - (60 * 60 * 1000);

    

                        for (const roomId in allRooms) {

                            const room = allRooms[roomId];

                            const players = room.players ? Object.values(room.players) : [];

                            const hasConnectedHumanPlayers = players.some((p: any) => !p.id.startsWith('BOT-') && p.connectionStatus === 'connected');

                            const lastActivity = room.public?.lastActivityTimestamp;

    

                            // Delete if no connected players, OR if there are "connected" players but the room has been inactive for over an hour.

                            if (!hasConnectedHumanPlayers || (lastActivity && lastActivity < oneHourAgo)) {

                                if (lastActivity && lastActivity < oneHourAgo) {

                                    console.log(`Marking stale room ${roomId} for deletion (last activity was at ${new Date(lastActivity).toISOString()}).`);

                                } else {

                                    console.log(`Marking empty room ${roomId} for deletion.`);

                                }

                                updates[`rooms/${roomId}`] = null;

                            }

                        }

                        if (Object.keys(updates).length > 0) {

                            await db.ref().update(updates);

                            console.log(`${Object.keys(updates).length} empty/stale rooms deleted.`);

                        }

                    }

                }

                 else {

                    console.log("Skipping garbage collection, client is offline.");

                }

            } catch (e) {

                console.warn("Garbage collection script failed:", e);

            }

            // --- End Garbage Collection ---

    

    

    

            const playerId = localPlayerId;        const authUid = firebaseAuthUid;

            if (!playerId || !authUid) {

                setError("Ошибка аутентификации. Пожалуйста, попробуйте снова.");

                setIsLoading(false);

                return;

            }

            const roomId = generateId();

    

                    const hostProfile = { id: playerId, name: playerName, avatar, firebaseAuthUid: authUid };

                    const hostState: Omit<Player, 'name' | 'avatar' | 'firebaseAuthUid'> = { 

                        id: playerId, 

                        isSpy: false, 

                        isEliminated: false, 

                        isHost: true, 

                        connectionStatus: 'connected', 

                        joinTimestamp: firebase.database.ServerValue.TIMESTAMP as any 

                    };

                    

                    const initialState = {

                        playerProfiles: { [playerId]: hostProfile },

                        players: { [playerId]: hostState },

    

                        public: {

    

                            roomId,

    

                            hostId: playerId,

    

                            gamePhase: 'SETUP',

    

                            initialSpyCount: 1,

    

                            votingEnabled: true,

    

                            questionSource: 'library',

    

                            familyFriendly: true,

    

                            noTimer: false,

    

                            roundLimit: true,

    

                            showQuestionToSpy: true,

    

                            anonymousVoting: false,

    

                            hideAnswerStatus: false,

    

                            round: 1,

    

                            usedQuestionIds: [],

    

                            usedQuestionTexts: [],

    

                            currentQuestion: null,

    

                            answers: [],

    

                            votes: [],

    

                            lastEliminated: null,

    

                            winner: null,

    

                            answerTimerEnd: null,

    

                            voteTimerEnd: null,

    

                            lastActivityTimestamp: firebase.database.ServerValue.TIMESTAMP as any,

    

                        },

    

                        chatMessages: [],

    

                    };

            

            try {

                await db.ref(`rooms/${roomId}`).set(initialState);

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

            const roomRef = db.ref(`rooms/${upperRoomId}`);

        

            try {

                const snapshot = await roomRef.get();

                if (!snapshot.exists()) {

                    setError('Комната не найдена. Проверьте код.');

                    return;

                }

        

                            const roomState = snapshot.val();

        

                

        

                            // --- GHOST ROOM CLEANUP ---

        

                            const playersInRoom = roomState.players ? Object.values(roomState.players) : [];

        

                            if (playersInRoom.length === 0) {

        

                                await roomRef.remove();

        

                                setError('Комната не найдена (была пуста и удалена).');

        

                                return;

        

                            }

        

                            // --- END GHOST ROOM CLEANUP ---

        

                

        

                            const playerProfilesInRoom = Object.values(roomState.playerProfiles || {}) as Player[];

        

                            const playerStatesInRoom = roomState.players || {};

        

                    

        

                            // Rejoin Logic (check for disconnected players with the same Firebase Auth UID)

        

                            const rejoiningPlayerAuthUid = firebaseAuthUid;

        

                            const disconnectedPlayerProfile = playerProfilesInRoom.find(p => 

        

                                p.firebaseAuthUid === rejoiningPlayerAuthUid && 

        

                                playerStatesInRoom[p.id]?.connectionStatus === 'disconnected'

        

                            );

        

                    

        

                            if (disconnectedPlayerProfile) {

        

                                const rejoiningPlayerId = disconnectedPlayerProfile.id;

        

                                if (!rejoiningPlayerId || !rejoiningPlayerAuthUid) {

        

                                    setError("Ошибка аутентификации. Пожалуйста, попробуйте снова.");

        

                                    setIsLoading(false);

        

                                    return;

        

                                }

        

                    

        

                                const updates: { [key: string]: any } = {};

        

                                // Update dynamic state

        

                                updates[`players/${rejoiningPlayerId}/connectionStatus`] = 'connected';

        

                                // Update static profile data

        

                                updates[`playerProfiles/${rejoiningPlayerId}/name`] = playerName;

        

                                updates[`playerProfiles/${rejoiningPlayerId}/avatar`] = avatar;

        

                                updates[`playerProfiles/${rejoiningPlayerId}/firebaseAuthUid`] = rejoiningPlayerAuthUid; // Ensure this is up-to-date

        

                                // Update activity timestamp

        

                                updates['public/lastActivityTimestamp'] = firebase.database.ServerValue.TIMESTAMP;

        

                

        

                                await roomRef.update(updates);

        

                    

        

                                setLocalPlayerId(rejoiningPlayerId);

        

                                subscribeToGameState(upperRoomId, rejoiningPlayerId);

        

                                localStorage.setItem('spy-game-session', JSON.stringify({ roomId: upperRoomId, playerId: rejoiningPlayerId }));

        

                                return;

        

                            }

        

                    

        

                            // --- New Player Join Logic ---

        

                            // Allow joining if the name is taken by the same user (who is stuck as 'connected')

        

                            if (playerProfilesInRoom.some(p => p.name === playerName && p.firebaseAuthUid !== firebaseAuthUid)) {

        

                                setError('Игрок с таким именем уже в комнате.');

        

                                return;

        

                            }

        

                    

        

                            if (roomState.public.gamePhase !== 'SETUP') {

        

                                setError('Игра уже началась. Вы не можете присоединиться.');

        

                                return;

        

                            }

        

                            

        

                                                        if (playerProfilesInRoom.length >= 12) {

        

                            

        

                                    

        

                            

        

                                                            setError('Комната заполнена.');

        

                            

        

                                    

        

                            

        

                                                            return;

        

                            

        

                                    

        

                            

        

                                                        }

        

                            

        

                                    

        

                            

        

                                            const playerId = localPlayerId;

        

                            

        

                                            const authUid = firebaseAuthUid;

        

                            

        

                                            if (!playerId || !authUid) {

        

                            

        

                                                setError("Ошибка аутентификации. Пожалуйста, попробуйте снова.");

        

                            

        

                                                setIsLoading(false);

        

                            

        

                                                return;

        

                            

        

                                            }

        

                            

        

                                            const newPlayerProfile = { id: playerId, name: playerName, avatar, firebaseAuthUid: authUid };

        

                            

        

                                            const newPlayerState: Omit<Player, 'name' | 'avatar' | 'firebaseAuthUid'> = { 

        

                            

        

                                                id: playerId, 

        

                            

        

                                                isSpy: false, 

        

                            

        

                                                isEliminated: false, 

        

                            

        

                                                isHost: false, 

        

                            

        

                                                connectionStatus: 'connected', 

        

                            

        

                                                joinTimestamp: firebase.database.ServerValue.TIMESTAMP as any 

        

                            

        

                                            };

        

                            

        

                                            

        

                            

        

                                            await db.ref(`rooms/${upperRoomId}/playerProfiles/${playerId}`).set(newPlayerProfile);

        

                            

        

                                            await db.ref(`rooms/${upperRoomId}/players/${playerId}`).set(newPlayerState);

        

                            

        

                                            await db.ref(`rooms/${upperRoomId}/public/lastActivityTimestamp`).set(firebase.database.ServerValue.TIMESTAMP as any);

        

                            

        

                                    

        

                            

        

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
        if (!isHost || !publicGameState?.roomId || !localPlayerId) return;
        const updates: { [key: string]: any } = {};
        updates[`rooms/${publicGameState.roomId}/public/hostId`] = newHostId;
        updates[`rooms/${publicGameState.roomId}/players/${newHostId}/isHost`] = true;
        updates[`rooms/${publicGameState.roomId}/players/${localPlayerId}/isHost`] = false;
        db.ref().update(updates).catch(e => console.error("Failed to transfer host:", e));
    };

    const startNewRound = useCallback(async (baseState?: GameState) => {
        const currentState = baseState || combinedGameState;
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
    }, [isHost, combinedGameState, players, updateGameState]);

    const handleVoteTally = useCallback(() => {
        if (!isHost || !combinedGameState || combinedGameState.gamePhase !== 'RESULTS_DISCUSSION') return;
        
        const currentActivePlayers = Object.values(players).filter((p: Player) => !p.isEliminated);
        const requiredVotes = Math.ceil(currentActivePlayers.length / 2);

        // FIX: Filter out votes from or for players who no longer exist (e.g., were kicked).
        const currentVotes = combinedGameState.votes ?? [];
        const validPlayerIds = new Set(Object.keys(players));
        const cleanVotes = currentVotes.filter(vote => 
            validPlayerIds.has(vote.voterId) && 
            (vote.votedForId === null || validPlayerIds.has(vote.votedForId))
        );

        const actualVotes = cleanVotes.filter(v => v.votedForId !== null);
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

        let eliminatedPlayerId: string | null = null;
        let updates: { [key: string]: any } = {
            '/public/lastEliminated': null,
            '/public/voteTimerEnd': null,
            '/public/gamePhase': 'VOTE_REVEAL',
            '/public/lastActivityTimestamp': firebase.database.ServerValue.TIMESTAMP,
            '/public/votes': cleanVotes, // Persist the cleaned votes array
        };

        if (playersToEliminate.length === 1 && maxVotes >= requiredVotes) {
            const eliminatedId = playersToEliminate[0];
            if (players[eliminatedId]) { // CRITICAL: Check if player exists
                updates[`/players/${eliminatedId}/isEliminated`] = true;
                eliminatedPlayerId = eliminatedId;
                updates['/public/lastEliminated'] = eliminatedPlayerId;
            }
        }

        if (publicGameState?.roomId) {
            db.ref(`rooms/${publicGameState.roomId}`).update(updates)
                .catch(e => console.error("Failed to tally votes:", e));
        }
    }, [isHost, combinedGameState, players]);

    // Host-side useEffects for phase transitions
    useEffect(() => {
        if (!isHost || !publicGameState || publicGameState.noTimer) return;
        let timer: number | undefined;

        if (publicGameState.gamePhase === 'ANSWERING' && publicGameState.answerTimerEnd) {
            const delay = publicGameState.answerTimerEnd - Date.now();
            timer = window.setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'ANSWERING') {
                    updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: publicGameState.noTimer ? null : Date.now() + activePlayers.length * 10000 });
                }
            }, Math.max(0, delay));
        } else if (publicGameState.gamePhase === 'RESULTS_DISCUSSION' && publicGameState.voteTimerEnd) {
            const delay = publicGameState.voteTimerEnd - Date.now();
            timer = window.setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'RESULTS_DISCUSSION') {
                    handleVoteTally();
                }
            }, Math.max(0, delay));
        }
        return () => clearTimeout(timer);
    }, [isHost, publicGameState, activePlayers.length, handleVoteTally, updateGameState]);

    // Auto-progress when all connected players have answered
    useEffect(() => {
        if (!isHost || !combinedGameState || combinedGameState.gamePhase !== 'ANSWERING') {
            return;
        }

        const connectedActivePlayers = activePlayers.filter(p => p.connectionStatus === 'connected');
        if (connectedActivePlayers.length === 0) return;

        const answeredPlayerIds = new Set((combinedGameState.answers || []).map(a => a.playerId));
        const allConnectedAnswered = connectedActivePlayers.every(p => answeredPlayerIds.has(p.id));

        if (allConnectedAnswered) {
             const timer = setTimeout(() => {
                if (gameStateRef.current?.gamePhase === 'ANSWERING') {
                   updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: combinedGameState.noTimer ? null : Date.now() + activePlayers.length * 10000 });
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isHost, combinedGameState, activePlayers, updateGameState]);

    // Auto-progress when all connected players have voted
    useEffect(() => {
        if (isHost && combinedGameState?.gamePhase === 'RESULTS_DISCUSSION' && combinedGameState.votingEnabled) {
            const connectedActivePlayers = activePlayers.filter(p => p.connectionStatus === 'connected');
            if (connectedActivePlayers.length > 0 && (combinedGameState.votes ?? []).length >= connectedActivePlayers.length) {
                handleVoteTally();
            }
        }
    }, [isHost, combinedGameState, activePlayers, handleVoteTally]);

    useEffect(() => {
        if (isHost && publicGameState?.gamePhase === 'ROLE_REVEAL') {
            const allAcknowledged = Object.values(players).every((p: Player) => p.roleAcknowledged || p.isEliminated || p.connectionStatus === 'disconnected');
            if (allAcknowledged) {
                const timer = setTimeout(() => updateGameState({ gamePhase: 'SYNCING_NEXT_ROUND' }), 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [isHost, publicGameState, players, updateGameState]);

    const handleAction = (path: string, value: any, condition?: (currentData: any) => boolean) => {
        if (!publicGameState?.roomId || !localPlayerId) return;
        const actionRef = db.ref(`rooms/${publicGameState.roomId}/${path}`);
        actionRef.transaction((currentData) => {
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
        if (!isHost || !players) return;

        const playerList = Object.values({ ...players }) as Player[];
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

        const playerUpdates: { [key: string]: any } = {};
        Object.keys(players).forEach(id => {
            playerUpdates[`/players/${id}/isSpy`] = spyIds.has(id);
            playerUpdates[`/players/${id}/roleAcknowledged`] = false;
        });
        
        setForcedSpies(new Set());

        // Atomically update player roles and game phase
        const rootUpdates: { [key: string]: any } = {
            ...playerUpdates,
            '/public/initialSpyCount': spyCount,
            '/public/questionSource': source,
            '/public/familyFriendly': familyMode,
            '/public/gamePhase': 'ROLE_REVEAL',
            '/public/lastActivityTimestamp': firebase.database.ServerValue.TIMESTAMP,
        };

        if (publicGameState?.roomId) {
            db.ref(`rooms/${publicGameState.roomId}`).update(rootUpdates)
                .catch(e => console.error("Failed to start game:", e));
        }
    };

    const handleAcknowledgeRole = () => {
        if (!publicGameState?.roomId || !localPlayerId) return;
        db.ref(`rooms/${publicGameState.roomId}/players/${localPlayerId}/roleAcknowledged`).set(true)
            .catch(e => console.error("Firebase set roleAcknowledged error:", e));
    };

    const handleRoleRevealContinue = () => {
        if (!isHost || !players) return;
        const allAcknowledged = Object.values(players).every((p: Player) => p.roleAcknowledged || p.isEliminated || p.connectionStatus === 'disconnected');

        if (allAcknowledged) {
            updateGameState({ gamePhase: 'SYNCING_NEXT_ROUND' });
        } else {
            startNewRound(combinedGameState!);
        }
    };

    const handleAnswerSubmit = (answer: string) => {
        handleAction('public/answers', { playerId: localPlayerId, answer }, 
            (current) => current?.some((a: Answer) => a.playerId === localPlayerId));
        if (publicGameState?.roomId) {
            db.ref(`rooms/${publicGameState.roomId}/public/lastActivityTimestamp`).set(firebase.database.ServerValue.TIMESTAMP);
        }
    };

    const handleVoteSubmit = (votedForId: string | null) => {
        handleAction('public/votes', { voterId: localPlayerId, votedForId },
            (current) => current?.some((v: Vote) => v.voterId === localPlayerId));
        if (publicGameState?.roomId) {
            db.ref(`rooms/${publicGameState.roomId}/public/lastActivityTimestamp`).set(firebase.database.ServerValue.TIMESTAMP);
        }
    };

    const handleVoteRevealFinished = async () => {
        if (!isHost || !combinedGameState) return;
        const winner = checkWinConditions(Object.values(players));
        const initialPlayerCount = Object.keys(players).length;
        if (winner || (combinedGameState.roundLimit && combinedGameState.round >= initialPlayerCount - 1)) {
            updateGameState({ winner: winner || 'SPIES', gamePhase: 'GAME_OVER' });
        } else {
            const playerUpdates: { [key: string]: any } = {};
            Object.keys(players).forEach(id => {
                playerUpdates[`/players/${id}/readyForNextRound`] = false;
            });
            const rootUpdates: { [key: string]: any } = {
                ...playerUpdates,
                '/public/gamePhase': 'SYNCING_NEXT_ROUND',
                '/public/lastActivityTimestamp': firebase.database.ServerValue.TIMESTAMP,
            };
            if (publicGameState?.roomId) {
                db.ref(`rooms/${publicGameState.roomId}`).update(rootUpdates)
                    .catch(e => console.error("Failed to finish vote reveal:", e));
            }
        }
    };
    
    const handleReadyForNextRound = useCallback(() => {
        if (publicGameState?.roomId && localPlayerId) {
            const playerReadyRef = db.ref(`rooms/${publicGameState.roomId}/players/${localPlayerId}/readyForNextRound`);
            playerReadyRef.set(true).catch(e => console.error("Firebase set readyForNextRound error:", e));
        }
    }, [publicGameState?.roomId, localPlayerId]);

    const handleContinueToNextRound = useCallback(() => {
        if (!isHost || !combinedGameState) return;
        const nextRoundState = { ...combinedGameState, round: combinedGameState.round + 1 };
        startNewRound(nextRoundState);
    }, [isHost, combinedGameState, startNewRound]);

    const handleReplay = async () => {
        if (!isHost || !players || !publicGameState.roomId) return;
        
        const playerUpdates: { [key: string]: any } = {};
        Object.keys(players).forEach(id => {
            playerUpdates[`/players/${id}/isEliminated`] = false;
            playerUpdates[`/players/${id}/isSpy`] = false;
            playerUpdates[`/players/${id}/roleAcknowledged`] = false;
            playerUpdates[`/players/${id}/readyForNextRound`] = false;
        });

        const rootUpdates: { [key: string]: any } = {
            ...playerUpdates,
            '/public/round': 1,
            '/public/usedQuestionIds': [],
            '/public/usedQuestionTexts': [],
            '/public/currentQuestion': null,
            '/public/answers': [],
            '/public/votes': [],
            '/public/lastEliminated': null,
            '/public/winner': null,
            '/public/gamePhase': 'SETUP',
            '/public/lastActivityTimestamp': firebase.database.ServerValue.TIMESTAMP,
        };
        
        await db.ref(`rooms/${publicGameState.roomId}`).update(rootUpdates)
            .catch(e => console.error("Failed to replay:", e));
    };

    const handleSendMessage = (text: string) => {
        if (!localPlayer || !publicGameState?.roomId) return;
        const message: ChatMessage = { senderId: localPlayer.id, senderName: localPlayer.name, senderAvatar: localPlayer.avatar || null, text, timestamp: firebase.database.ServerValue.TIMESTAMP as any, status: 'sent' };
        const roomRef = db.ref(`rooms/${publicGameState.roomId}`);
        roomRef.child('chatMessages').push(message)
            .then(() => {
                roomRef.child('public/lastActivityTimestamp').set(firebase.database.ServerValue.TIMESTAMP);
            })
            .catch(e => console.error("Failed to send message:", e));
    };

    const handleChatOpen = useCallback(() => {
        if (!publicGameState?.roomId || !localPlayerId || !chatMessages) {
            return;
        }

        const chatMessagesRef = db.ref(`rooms/${publicGameState.roomId}/chatMessages`);
        const updates: { [key: string]: 'read' } = {};

        // chatMessages is now an array of message objects, each with a 'key' property
        for (const message of chatMessages) {
            if (message.senderId !== localPlayerId && message.status !== 'read' && message.key) {
                updates[`${message.key}/status`] = 'read';
            }
        }
        
        if (Object.keys(updates).length > 0) {
            chatMessagesRef.update(updates).catch(e => console.error("Failed to update chat status:", e));
        }
    }, [publicGameState, localPlayerId, chatMessages]);
    
    const handleKickPlayer = (playerId: string) => {
        if (isHost && publicGameState?.roomId) {
            const updates: { [key: string]: null } = {};
            updates[`rooms/${publicGameState.roomId}/playerProfiles/${playerId}`] = null;
            updates[`rooms/${publicGameState.roomId}/players/${playerId}`] = null;
            db.ref().update(updates).catch(e => console.error("Failed to kick player:", e));
        }
    };

    const handleToggleForceSpy = useCallback((playerId: string) => {
        setForcedSpies(prev => {
            const newSet = new Set(prev);
            const playerState = players[playerId];
            if (!playerState) return prev; // Player not found in current state

            if (newSet.has(playerId)) {
                newSet.delete(playerId);
                if (publicGameState?.roomId) {
                    db.ref(`rooms/${publicGameState.roomId}/players/${playerId}/isSpy`).set(false);
                }
            } else {
                if (newSet.size < (publicGameState?.initialSpyCount || 1)) {
                    newSet.add(playerId);
                    if (publicGameState?.roomId) {
                        db.ref(`rooms/${publicGameState.roomId}/players/${playerId}/isSpy`).set(true);
                    }
                } else {
                    alert(`Вы можете выбрать не более ${publicGameState?.initialSpyCount} шпионов.`);
                }
            }
            return newSet;
        });
    }, [publicGameState?.initialSpyCount, publicGameState?.roomId, players]);

    useEffect(() => {
        if (!isHost || !publicGameState || publicGameState.gamePhase !== 'SYNCING_NEXT_ROUND') {
            return;
        }

        const activePlayers = Object.values(players).filter((p: Player) => !p.isEliminated);
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
    }, [isHost, publicGameState, players, handleContinueToNextRound]);

    if (isLoading || !isAuthReady) return <LoadingScreen title="Подключение..." />;
    if (error) return <div className="flex flex-col items-center justify-center text-center min-h-[450px]"><h2 className="text-3xl font-bold text-red-500 mb-4">Ошибка</h2><p className="text-slate-300 mb-8">{error}</p><button onClick={() => handleLeaveRoom(true)} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl">Вернуться в меню</button></div>;
    if (!publicGameState.roomId || !localPlayerId) return <LobbyScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} initialRoomId={rememberedRoomId} />;

    const renderGameScreen = () => {
        if (isGenerating) return <LoadingScreen title="ИИ генерирует вопрос..." description="Это может занять несколько секунд." />;

        switch (publicGameState.gamePhase) {
            case 'SETUP': return <SetupScreen onGameStart={handleGameStart} players={playerList} isHost={isHost} roomId={publicGameState.roomId!} initialSettings={combinedGameState!} onSettingsChange={(s) => updateGameState(s as GameState)} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} forcedSpies={forcedSpies} />;
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
            case 'ANSWERING': return <AnsweringScreen player={localPlayer} players={activePlayers} question={publicGameState.currentQuestion!} answers={publicGameState.answers as Answer[]} onSubmit={handleAnswerSubmit} timerEnd={publicGameState.answerTimerEnd} isLocalMode={false} isHost={isHost} noTimer={publicGameState.noTimer} onForceEndAnswering={() => updateGameState({ gamePhase: 'RESULTS_DISCUSSION', votes: [], voteTimerEnd: publicGameState.noTimer ? null : Date.now() + activePlayers.length * 10000 })} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} showQuestionToSpy={publicGameState.showQuestionToSpy} hideAnswerStatus={publicGameState.hideAnswerStatus} />;
            case 'RESULTS_DISCUSSION': return <ResultsDiscussionScreen question={publicGameState.currentQuestion!} players={playerList} answers={(publicGameState.answers ?? []) as Answer[]} onVote={handleVoteSubmit} onTally={handleVoteTally} votingEnabled={publicGameState.votingEnabled} localPlayerId={localPlayerId} votes={(publicGameState.votes ?? []) as Vote[]} timerEnd={publicGameState.voteTimerEnd} isHost={isHost} isLocalMode={false} noTimer={publicGameState.noTimer} onKickPlayer={handleKickPlayer} onTransferHost={handleTransferHost} showQuestionToSpy={publicGameState.showQuestionToSpy} revealVotes={isKonamiActive} />;
            case 'VOTE_REVEAL': 
                const eliminatedPlayer = playerList.find(p => p.id === publicGameState.lastEliminated) || null;
                return <VoteRevealScreen eliminatedPlayer={eliminatedPlayer} votes={(publicGameState.votes ?? []) as Vote[]} players={playerList} onContinue={handleVoteRevealFinished} isHost={isHost} isLocalMode={false} anonymousVoting={publicGameState.anonymousVoting} revealSpies={isKonamiActive} />;
            case 'GAME_OVER': return <GameOverScreen winner={publicGameState.winner!} players={playerList} onNewGame={() => handleLeaveRoom(true)} onReplay={handleReplay} isHost={isHost} isLocalMode={false} />;
            default: return <div>Загрузка...</div>;
        }
    };
    
    return (
        <>
            {localPlayer && publicGameState.gamePhase !== 'GAME_OVER' && (
                <Chat 
                    localPlayer={localPlayer} 
                    messages={memoizedChatMessages} 
                    onSendMessage={handleSendMessage} 
                    onChatOpen={handleChatOpen} 
                    isEliminated={localPlayer.isEliminated}
                />
            )}
            {renderGameScreen()}
            {isDebugMenuOpen && combinedGameState && <DebugMenu gameState={combinedGameState} onClose={closeDebugMenu} forcedSpies={forcedSpies} onToggleForceSpy={handleToggleForceSpy} isHost={isHost} />}
        </>
    );
});