import React, { useEffect } from 'react';
import { GameState, Player, Answer, Vote, ChatMessage } from '../types';
import { db } from '../firebase';
import { ref, set, push, update, remove, serverTimestamp, runTransaction } from 'firebase/database';
import { generateId } from '../utils';

const RANDOM_NAMES: string[] = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
const RANDOM_AVATARS: string[] = ['😀', '😎', '🤖', '👽', '🤡', '🦄', '🦊', '🐙', '🦁', '🐸'];
const RANDOM_MESSAGES: string[] = ['Всем привет!', 'Кто шпион?', 'Подозрительно...', '🤔', 'Я думаю, это ты!', 'Ха-ха', 'Я не шпион, честно!', 'Очень интересный вопрос.', 'Сложный выбор.', 'Всем удачи!'];

interface DebugMenuProps {
    gameState: GameState;
    onClose: () => void;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ gameState, onClose }) => {
    
    useEffect(() => {
        if (!gameState.roomId) return;
        const updates: { [key: string]: any } = {};
        let shouldUpdate = false;
        
        const fakePlayerIds = Object.keys(gameState.players).filter(id => id.startsWith('BOT-'));

        fakePlayerIds.forEach(botId => {
            const bot = gameState.players[botId];
            if (!bot) return;

            // Auto-acknowledge role
            if (gameState.gamePhase === 'ROLE_REVEAL' && !bot.roleAcknowledged) {
                updates[`/rooms/${gameState.roomId}/players/${botId}/roleAcknowledged`] = true;
                shouldUpdate = true;
            }
        });

        if (shouldUpdate) {
            update(ref(db), updates);
        }
    }, [gameState]);


    const addFakePlayer = () => {
        if (gameState.gamePhase !== 'SETUP') {
            alert("Можно добавлять ботов только в лобби.");
            return;
        }
        // FIX: Cast `Object.values` to `Player[]` to ensure TypeScript correctly infers the type of `currentPlayers` and its elements.
        const currentPlayers = Object.values(gameState.players) as Player[];
        if (currentPlayers.length >= 12) {
            alert("Достигнут максимум игроков.");
            return;
        }

        const playerId = 'BOT-' + generateId();
        
        const baseName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        let name = baseName;
        let counter = 1;
        while (currentPlayers.some(p => p.name === name)) {
            name = `${baseName} #${counter}`;
            counter++;
        }
        
        const avatar = RANDOM_AVATARS[Math.floor(Math.random() * RANDOM_AVATARS.length)];

        const newPlayer: Player = {
            id: playerId, name, avatar, isSpy: false, isEliminated: false, isHost: false,
            connectionStatus: 'connected', joinTimestamp: serverTimestamp() as any,
            roleAcknowledged: false, readyForNextRound: false,
        };

        const playerRef = ref(db, `rooms/${gameState.roomId}/players/${playerId}`);
        set(playerRef, newPlayer);
    };

    const removeFakePlayer = (botId: string) => {
        const playerRef = ref(db, `rooms/${gameState.roomId}/players/${botId}`);
        remove(playerRef);
    };

    // FIX: Cast `Object.values` to `Player[]` to ensure TypeScript correctly infers the type of `bots` and its elements, resolving multiple downstream 'property does not exist on type unknown' errors.
    const getConnectedBots = (includeEliminated = false) => {
        let bots = (Object.values(gameState.players) as Player[]).filter(p => 
            p.id.startsWith('BOT-') && 
            p.connectionStatus === 'connected'
        );
        if (!includeEliminated) {
            bots = bots.filter(p => !p.isEliminated);
        }
        return bots;
    };

    const handleBulkMessage = () => {
        getConnectedBots(true).forEach(bot => sendRandomMessage(bot));
    };

    const handleBulkAnswer = () => {
        if (gameState.gamePhase !== 'ANSWERING') return;
        getConnectedBots().forEach(bot => sendRandomAnswer(bot.id));
    };

    const handleBulkVote = () => {
        if (gameState.gamePhase !== 'RESULTS_DISCUSSION' || !gameState.votingEnabled) return;
        getConnectedBots().forEach(bot => sendRandomVote(bot.id));
    };
    
    const handleBulkReady = () => {
        if (gameState.gamePhase !== 'SYNCING_NEXT_ROUND' || !gameState.roomId) return;
        
        const updates: { [key: string]: boolean } = {};
        const bots = getConnectedBots();

        bots.forEach(bot => {
            if (!bot.readyForNextRound) {
                updates[`/rooms/${gameState.roomId}/players/${bot.id}/readyForNextRound`] = true;
            }
        });

        if (Object.keys(updates).length > 0) {
            update(ref(db), updates);
        }
    };

    const handleBulkKick = () => {
        getConnectedBots(true).forEach(bot => removeFakePlayer(bot.id));
    };

    const toggleConnection = (botId: string, currentStatus: 'connected' | 'disconnected' | undefined) => {
        const newStatus = currentStatus === 'connected' ? 'disconnected' : 'connected';
        const playerStatusRef = ref(db, `rooms/${gameState.roomId}/players/${botId}/connectionStatus`);
        set(playerStatusRef, newStatus);
    };

    const sendRandomMessage = (bot: Player) => {
        const messageText = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
        const message: ChatMessage = {
            senderId: bot.id, senderName: bot.name, senderAvatar: bot.avatar, text: messageText,
            timestamp: serverTimestamp() as any, status: 'sent'
        };
        const chatRef = ref(db, `rooms/${gameState.roomId}/chatMessages`);
        push(chatRef, message);
    };

    const sendRandomAnswer = (botId: string) => {
        if (gameState.gamePhase !== 'ANSWERING' || !gameState.currentQuestion) return;
        if (gameState.answers?.some(a => a.playerId === botId)) return;

        const answerOptions = gameState.currentQuestion.answers;
        if (!answerOptions || answerOptions.length === 0) return;

        const randomAnswer = answerOptions[Math.floor(Math.random() * answerOptions.length)];
        const answerRef = ref(db, `rooms/${gameState.roomId}/answers`);
        runTransaction(answerRef, (currentData: Answer[] | null) => {
            const newAnswer = { playerId: botId, answer: randomAnswer };
            if (!currentData) return [newAnswer];
            if (currentData.some(a => a.playerId === botId)) return; // Abort
            return [...currentData, newAnswer];
        });
    };

    const sendRandomVote = (botId: string) => {
        if (gameState.gamePhase !== 'RESULTS_DISCUSSION' || !gameState.votingEnabled) return;
        if (gameState.votes?.some(v => v.voterId === botId)) return;

        // FIX: Cast `Object.values` to `Player[]` to ensure TypeScript correctly infers the type of `activePlayers` and its elements.
        const activePlayers = (Object.values(gameState.players) as Player[]).filter(p => !p.isEliminated);
        if (activePlayers.length === 0) return;

        const shouldSkip = Math.random() < 0.1;
        let votedForId: string | null = null;
        if (!shouldSkip) {
            const randomTarget = activePlayers[Math.floor(Math.random() * activePlayers.length)];
            votedForId = randomTarget.id;
        }

        const voteRef = ref(db, `rooms/${gameState.roomId}/votes`);
        runTransaction(voteRef, (currentData: Vote[] | null) => {
            const newVote = { voterId: botId, votedForId };
            if (!currentData) return [newVote];
            if (currentData.some(v => v.voterId === botId)) return; // Abort
            return [...currentData, newVote];
        });
    };

    const markAsReady = (botId: string) => {
        const playerReadyRef = ref(db, `rooms/${gameState.roomId}/players/${botId}/readyForNextRound`);
        set(playerReadyRef, true);
    };

    const commonButtonClass = "text-xs py-1 px-2 rounded bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed";
    const bulkButtonClass = "text-xs py-2 px-2 rounded bg-slate-600 hover:bg-slate-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed";
    // FIX: Explicitly type player `id` to resolve properties on type 'unknown'.
    const fakePlayerIds = Object.keys(gameState.players).filter((id: string) => id.startsWith('BOT-'));

    return (
        <div className="fixed bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-cyan-500 z-50 w-96 max-h-[90vh] flex flex-col text-white animate-fade-in">
            <div className="flex justify-between items-center p-3 border-b border-slate-700">
                <h2 className="font-bold text-cyan-400">Меню отладки</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

            <div className="p-3 space-y-2 border-b border-slate-700">
                <button onClick={addFakePlayer} disabled={gameState.gamePhase !== 'SETUP'} className="w-full py-2 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-bold disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed">
                    Добавить бота
                </button>
                <div className="p-2 bg-slate-900/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-2 text-center">Массовые действия (для подключенных ботов):</p>
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={handleBulkMessage} className={bulkButtonClass}>Сообщ. за всех</button>
                        <button onClick={handleBulkAnswer} disabled={gameState.gamePhase !== 'ANSWERING'} className={bulkButtonClass}>Ответ за всех</button>
                        <button onClick={handleBulkVote} disabled={gameState.gamePhase !== 'RESULTS_DISCUSSION' || !gameState.votingEnabled} className={bulkButtonClass}>Голос за всех</button>
                        <button onClick={handleBulkReady} disabled={gameState.gamePhase !== 'SYNCING_NEXT_ROUND'} className={bulkButtonClass}>Готов за всех</button>
                        <button onClick={handleBulkKick} className={`${bulkButtonClass} bg-red-800 hover:bg-red-700 col-span-2`}>Кикнуть всех</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-3">
                {fakePlayerIds.map(botId => {
                    const bot = gameState.players[botId];
                    if (!bot) return null;
                    const hasAnswered = gameState.answers?.some(a => a.playerId === botId);
                    const hasVoted = gameState.votes?.some(v => v.voterId === botId);

                    return (
                        <div key={botId} className="p-2 border-t border-slate-700">
                            <div className="flex justify-between items-center">
                                <p className="font-bold text-sm truncate">{bot.name}</p>
                                <button onClick={() => removeFakePlayer(botId)} className="text-xs text-red-400 hover:text-red-300">Удалить</button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <button onClick={() => toggleConnection(botId, bot.connectionStatus)} className={commonButtonClass}>
                                    {bot.connectionStatus === 'connected' ? 'Отключить' : 'Подключить'}
                                </button>
                                <button onClick={() => sendRandomMessage(bot)} className={commonButtonClass}>Сообщение</button>
                                <button onClick={() => sendRandomAnswer(botId)} disabled={gameState.gamePhase !== 'ANSWERING' || hasAnswered || bot.isEliminated} className={commonButtonClass}>Ответ</button>
                                <button onClick={() => sendRandomVote(botId)} disabled={gameState.gamePhase !== 'RESULTS_DISCUSSION' || hasVoted || bot.isEliminated || bot.connectionStatus !== 'connected'} className={commonButtonClass}>Голос</button>
                                <button onClick={() => markAsReady(botId)} disabled={gameState.gamePhase !== 'SYNCING_NEXT_ROUND' || bot.readyForNextRound || bot.connectionStatus !== 'connected'} className={commonButtonClass}>Готов</button>
                            </div>
                        </div>
                    );
                })}
                {fakePlayerIds.length === 0 && <p className="text-center text-slate-500 p-4 text-sm">Ботов нет.</p>}
            </div>
        </div>
    );
};