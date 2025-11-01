import React, { useEffect, useState } from 'react';
import { GameState, Player, Answer, Vote, ChatMessage } from '../types';
import { db } from '../firebase';
import firebase from 'firebase/app';
import 'firebase/database'; // Import database module for ServerValue.TIMESTAMP
import { generateId } from '../utils';
import { Avatar } from './Avatar';

const RANDOM_NAMES: string[] = ['Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'];
const RANDOM_AVATARS: string[] = ['😀', '😎', '🤖', '👽', '🤡', '🦄', '🦊', '🐙', '🦁', '🐸'];
const RANDOM_MESSAGES: string[] = ['Всем привет!', 'Кто шпион?', 'Подозрительно...', '🤔', 'Я думаю, это ты!', 'Ха-ха', 'Я не шпион, честно!', 'Очень интересный вопрос.', 'Сложный выбор.', 'Всем удачи!'];

interface DebugMenuProps {
    gameState: GameState;
    onClose: () => void;
    forcedSpies?: Set<string>;
    onToggleForceSpy?: (playerId: string) => void;
    isHost?: boolean;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ gameState, onClose, forcedSpies, onToggleForceSpy, isHost = true }) => {
    const [revealSpies, setRevealSpies] = useState(document.body.classList.contains('spy-reveal-mode'));
    const isDisabled = !isHost;
    
    useEffect(() => {
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    setRevealSpies((mutation.target as HTMLElement).classList.contains('spy-reveal-mode'));
                }
            }
        });
        observer.observe(document.body, { attributes: true });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isHost || !gameState.roomId) return;
        const updates: { [key: string]: any } = {};
        let shouldUpdate = false;
        
        const fakePlayerIds = Object.keys(gameState.players).filter(id => id.startsWith('BOT-'));

        fakePlayerIds.forEach(botId => {
            const bot = gameState.players[botId];
            if (!bot) return;

            if (gameState.gamePhase === 'ROLE_REVEAL' && !bot.roleAcknowledged) {
                updates[`/rooms/${gameState.roomId}/players/${botId}/roleAcknowledged`] = true;
                shouldUpdate = true;
            }
        });

        if (shouldUpdate) {
            // FIX: Replaced ref() and update() with v8 `db.ref()` and `ref.update()`.
            db.ref().update(updates);
        }
    }, [gameState, isHost]);


    const addFakePlayer = () => {
        if (gameState.gamePhase !== 'SETUP') {
            alert("Можно добавлять ботов только в лобби.");
            return;
        }
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
        // FIX: Replaced serverTimestamp() with v8 `firebase.database.ServerValue.TIMESTAMP`.
        const newPlayer: Player = { id: playerId, name, avatar, isSpy: false, isEliminated: false, isHost: false, connectionStatus: 'connected', joinTimestamp: firebase.database.ServerValue.TIMESTAMP as any, roleAcknowledged: false, readyForNextRound: false };
        // FIX: Replaced ref() and set() with v8 `db.ref()` and `ref.set()`.
        const playerRef = db.ref(`rooms/${gameState.roomId}/players/${playerId}`);
        playerRef.set(newPlayer);
    };

    const removeFakePlayer = (botId: string) => {
        // FIX: Replaced ref() and remove() with v8 `db.ref()` and `ref.remove()`.
        const playerRef = db.ref(`rooms/${gameState.roomId}/players/${botId}`);
        playerRef.remove();
    };

    const getConnectedBots = (includeEliminated = false) => {
        let bots = (Object.values(gameState.players) as Player[]).filter(p => p.id.startsWith('BOT-') && p.connectionStatus === 'connected');
        if (!includeEliminated) {
            bots = bots.filter(p => !p.isEliminated);
        }
        return bots;
    };

    const handleBulkMessage = () => getConnectedBots(true).forEach(bot => sendRandomMessage(bot));
    const handleBulkAnswer = () => { if (gameState.gamePhase === 'ANSWERING') getConnectedBots().forEach(bot => sendRandomAnswer(bot.id)); };
    const handleBulkVote = () => { if (gameState.gamePhase === 'RESULTS_DISCUSSION' && gameState.votingEnabled) getConnectedBots().forEach(bot => sendRandomVote(bot.id)); };
    const handleBulkReady = () => { if (gameState.gamePhase !== 'SYNCING_NEXT_ROUND' || !gameState.roomId) return; const updates: { [key: string]: boolean } = {}; getConnectedBots().forEach(bot => { if (!bot.readyForNextRound) updates[`/rooms/${gameState.roomId}/players/${bot.id}/readyForNextRound`] = true; }); if (Object.keys(updates).length > 0) db.ref().update(updates); };
    const handleBulkKick = () => getConnectedBots(true).forEach(bot => removeFakePlayer(bot.id));
    const toggleConnection = (botId: string, currentStatus: 'connected' | 'disconnected' | undefined) => db.ref(`rooms/${gameState.roomId}/players/${botId}/connectionStatus`).set(currentStatus === 'connected' ? 'disconnected' : 'connected');

    const sendRandomMessage = (bot: Player) => {
        const messageText = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
        // FIX: Replaced serverTimestamp() with v8 `firebase.database.ServerValue.TIMESTAMP`.
        const message: ChatMessage = { senderId: bot.id, senderName: bot.name, senderAvatar: bot.avatar, text: messageText, timestamp: firebase.database.ServerValue.TIMESTAMP as any, status: 'sent' };
        // FIX: Replaced ref() and push() with v8 `db.ref()` and `ref.push()`.
        db.ref(`rooms/${gameState.roomId}/chatMessages`).push(message);
    };

    const sendRandomAnswer = (botId: string) => {
        if (gameState.gamePhase !== 'ANSWERING' || !gameState.currentQuestion || gameState.answers?.some(a => a.playerId === botId)) return;
        const answerOptions = gameState.currentQuestion.answers;
        if (!answerOptions || answerOptions.length === 0) return;
        const randomAnswer = answerOptions[Math.floor(Math.random() * answerOptions.length)];
        // FIX: Replaced ref() and runTransaction() with v8 `db.ref()` and `ref.transaction()`.
        db.ref(`rooms/${gameState.roomId}/answers`).transaction((currentData: Answer[] | null) => {
            const newAnswer = { playerId: botId, answer: randomAnswer }; if (!currentData) return [newAnswer]; if (currentData.some(a => a.playerId === botId)) return; return [...currentData, newAnswer];
        });
    };

    const sendRandomVote = (botId: string) => {
        if (gameState.gamePhase !== 'RESULTS_DISCUSSION' || !gameState.votingEnabled || gameState.votes?.some(v => v.voterId === botId)) return;
        const activePlayers = (Object.values(gameState.players) as Player[]).filter(p => !p.isEliminated);
        if (activePlayers.length === 0) return;
        const shouldSkip = Math.random() < 0.1; let votedForId: string | null = null;
        if (!shouldSkip) votedForId = activePlayers[Math.floor(Math.random() * activePlayers.length)].id;
        // FIX: Replaced ref() and runTransaction() with v8 `db.ref()` and `ref.transaction()`.
        db.ref(`rooms/${gameState.roomId}/votes`).transaction((currentData: Vote[] | null) => {
            const newVote = { voterId: botId, votedForId }; if (!currentData) return [newVote]; if (currentData.some(v => v.voterId === botId)) return; return [...currentData, newVote];
        });
    };

    const markAsReady = (botId: string) => db.ref(`rooms/${gameState.roomId}/players/${botId}/readyForNextRound`).set(true);

    const commonButtonClass = "text-xs py-1 px-2 rounded bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed";
    const bulkButtonClass = "text-xs py-2 px-2 rounded bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed";
    const allPlayers = (Object.values(gameState.players) as Player[]).sort((a, b) => (a.joinTimestamp || 0) - (b.joinTimestamp || 0));
    const realPlayers = allPlayers.filter(p => !p.id.startsWith('BOT-'));
    const bots = allPlayers.filter(p => p.id.startsWith('BOT-'));
    const canForceSpies = gameState.gamePhase === 'SETUP' && onToggleForceSpy && forcedSpies;

    return (
        <div className="fixed bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-cyan-500 z-50 w-96 max-h-[90vh] flex flex-col text-white animate-fade-in">
            <div className="flex justify-between items-center p-3 border-b border-slate-700">
                <h2 className="font-bold text-cyan-400">Меню отладки</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>

             <div className="flex-1 overflow-y-auto px-3 py-1">
                {revealSpies && (
                    <div className="py-2 border-b border-slate-700">
                        <h3 className="font-bold text-sm text-cyan-400 mb-2">Игроки ({realPlayers.length})</h3>
                        {realPlayers.map(player => (
                            <div key={player.id} className="flex justify-between items-center p-1.5">
                                <div className="flex items-center gap-2 truncate">
                                    <Avatar avatar={player.avatar} className="w-6 h-6" />
                                    <p className="font-bold text-sm truncate">{player.name}</p>
                                    {revealSpies && player.isSpy && <span className="text-xs text-red-400 font-bold">(Шпион)</span>}
                                </div>
                                {canForceSpies && (
                                    <button
                                        disabled={isDisabled}
                                        onClick={() => onToggleForceSpy(player.id)}
                                        className={`${commonButtonClass} ${forcedSpies.has(player.id) ? 'bg-red-600 hover:bg-red-500' : ''}`}
                                    >
                                        {forcedSpies.has(player.id) ? 'Убрать' : 'Сделать шпионом'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="py-2">
                    <h3 className="font-bold text-sm text-cyan-400 mb-2">Боты ({bots.length})</h3>
                    <div className="space-y-2">
                         <button onClick={addFakePlayer} disabled={isDisabled || gameState.gamePhase !== 'SETUP'} className="w-full py-1.5 px-4 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-900 font-bold text-sm disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed">
                            Добавить бота
                        </button>
                        <div className="p-2 bg-slate-900/50 rounded-lg">
                            <p className="text-xs text-slate-400 mb-2 text-center">Массовые действия (для подключенных ботов):</p>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={handleBulkMessage} disabled={isDisabled} className={bulkButtonClass}>Сообщ. за всех</button>
                                <button onClick={handleBulkAnswer} disabled={isDisabled || gameState.gamePhase !== 'ANSWERING'} className={bulkButtonClass}>Ответ за всех</button>
                                <button onClick={handleBulkVote} disabled={isDisabled || gameState.gamePhase !== 'RESULTS_DISCUSSION' || !gameState.votingEnabled} className={bulkButtonClass}>Голос за всех</button>
                                <button onClick={handleBulkReady} disabled={isDisabled || gameState.gamePhase !== 'SYNCING_NEXT_ROUND'} className={bulkButtonClass}>Готов за всех</button>
                                <button onClick={handleBulkKick} disabled={isDisabled} className={`${bulkButtonClass} bg-red-800 hover:bg-red-700 col-span-2`}>Кикнуть всех</button>
                            </div>
                        </div>
                        {bots.map(bot => {
                            const hasAnswered = gameState.answers?.some(a => a.playerId === bot.id);
                            const hasVoted = gameState.votes?.some(v => v.voterId === bot.id);
                            return (
                                <div key={bot.id} className="p-2 border-t border-slate-700">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 truncate">
                                            <Avatar avatar={bot.avatar} className="w-6 h-6" />
                                            <p className="font-bold text-sm truncate">{bot.name}</p>
                                            {revealSpies && bot.isSpy && <span className="text-xs text-red-400 font-bold">(Шпион)</span>}
                                        </div>
                                        <button onClick={() => removeFakePlayer(bot.id)} disabled={isDisabled} className="text-xs text-red-400 hover:text-red-300 disabled:text-slate-600 disabled:cursor-not-allowed">Удалить</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {canForceSpies && (
                                            <button
                                                disabled={isDisabled}
                                                onClick={() => onToggleForceSpy(bot.id)}
                                                className={`${commonButtonClass} ${forcedSpies.has(bot.id) ? 'bg-red-600 hover:bg-red-500' : ''}`}
                                            >
                                                {forcedSpies.has(bot.id) ? 'Убрать' : 'Шпион'}
                                            </button>
                                        )}
                                        <button onClick={() => toggleConnection(bot.id, bot.connectionStatus)} disabled={isDisabled} className={commonButtonClass}>
                                            {bot.connectionStatus === 'connected' ? 'Отключить' : 'Подключить'}
                                        </button>
                                        <button onClick={() => sendRandomMessage(bot)} disabled={isDisabled} className={commonButtonClass}>Сообщение</button>
                                        <button onClick={() => sendRandomAnswer(bot.id)} disabled={isDisabled || gameState.gamePhase !== 'ANSWERING' || hasAnswered || bot.isEliminated} className={commonButtonClass}>Ответ</button>
                                        <button onClick={() => sendRandomVote(bot.id)} disabled={isDisabled || gameState.gamePhase !== 'RESULTS_DISCUSSION' || hasVoted || bot.isEliminated || bot.connectionStatus !== 'connected'} className={commonButtonClass}>Голос</button>
                                        <button onClick={() => markAsReady(bot.id)} disabled={isDisabled || gameState.gamePhase !== 'SYNCING_NEXT_ROUND' || bot.readyForNextRound || bot.connectionStatus !== 'connected'} className={commonButtonClass}>Готов</button>
                                    </div>
                                </div>
                            );
                        })}
                        {bots.length === 0 && <p className="text-center text-slate-500 pt-2 text-sm">Ботов нет.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};