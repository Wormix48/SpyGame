import React, { useState, useEffect } from 'react';
import { Player, Question, Answer, Vote } from '../types';
import { Avatar } from './Avatar';
import { CrossIcon, WarningIcon, CheckIcon, KeyIcon } from './icons';

interface TimerProps {
    expiryTimestamp: number | null;
    onExpire: () => void;
}

const Timer: React.FC<TimerProps> = ({ expiryTimestamp, onExpire }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!expiryTimestamp) return;

        const calculateTimeLeft = () => {
            const diff = expiryTimestamp - Date.now();
            return Math.round(Math.max(0, diff) / 1000);
        }

        const initialTime = calculateTimeLeft();
        setTimeLeft(initialTime);

        if (initialTime <= 0) {
            onExpire();
            return;
        }

        const interval = setInterval(() => {
            const newTime = calculateTimeLeft();
            if (newTime <= 0) {
                clearInterval(interval);
                onExpire();
            }
            setTimeLeft(newTime);
        }, 1000);

        return () => clearInterval(interval);
    }, [expiryTimestamp, onExpire]);

    if (!expiryTimestamp || timeLeft <= 0) return null;

    return (
        <div className="bg-slate-900/80 rounded-lg p-2 flex items-center justify-center border border-cyan-500 mb-4">
            <span className="text-cyan-400 text-xl font-bold">Время на голосование: {timeLeft}</span>
        </div>
    );
};


interface ResultsDiscussionScreenProps {
  question: Question;
  players: Player[];
  answers: Answer[];
  isHost: boolean;
  isLocalMode: boolean;
  
  // Online props (optional)
  votes?: Vote[];
  localPlayerId?: string;
  onVote?: (votedForId: string | null) => void;
  onTally?: () => void;
  votingEnabled?: boolean;
  timerEnd?: number | null;
  noTimer?: boolean;
  onKickPlayer?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;

  // Local props (optional)
  onFinishLocalVoting?: (votes: Vote[]) => void;
  localSequentialVoter?: Player;
  onFinishLocalSequentialVote?: (vote: Vote) => void;
  isDiscussionOnly?: boolean;
  onProceedToVote?: () => void;
  showQuestionToSpy?: boolean;
}

// FIX: Updated default prop functions to accept arguments, resolving "Expected 0 arguments, but got 1" errors.
export const ResultsDiscussionScreen: React.FC<ResultsDiscussionScreenProps> = ({ 
    question, players, answers, votes = [], localPlayerId = '', onVote = (votedForId: string | null) => {}, onTally = () => {}, 
    votingEnabled = true, timerEnd, isHost, isLocalMode, noTimer, 
    onFinishLocalVoting = (votes: Vote[]) => {}, localSequentialVoter, onFinishLocalSequentialVote = (vote: Vote) => {}, onKickPlayer = (playerId: string) => {}, onTransferHost = (playerId: string) => {},
    isDiscussionOnly = false, onProceedToVote = () => {}, showQuestionToSpy = true
}) => {
  const [localVotes, setLocalVotes] = useState<Record<string, string | null>>({});

  const shouldShowQuestion = () => {
    if (isLocalMode) {
        // In local mode on a shared screen, the question is shown/hidden for everyone based on the setting.
        return showQuestionToSpy;
    }
    const localPlayer = players.find(p => p.id === localPlayerId);
    if (!localPlayer) return true; // Default to showing if player not found (shouldn't happen)

    const localPlayerIsSpy = localPlayer.isSpy;
    const isSpectator = localPlayer.isEliminated;

    // In online mode, show if you're not a spy OR if the setting allows spies to see it.
    // Spectators (eliminated players) should always see the question.
    return !localPlayerIsSpy || showQuestionToSpy || isSpectator;
  };

  const hasVoted = (playerId: string) => {
    if (isLocalMode) return !!localVotes[playerId];
    return votes.some(v => v.voterId === playerId);
  }

  const getAnswerForPlayer = (playerId: string) => {
    return answers.find(a => a.playerId === playerId)?.answer || 'Нет ответа';
  };

  const activePlayers = players.filter(p => !p.isEliminated);

  const handleLocalVote = (voter: Player, votedFor: Player | null) => {
    setLocalVotes(prev => ({...prev, [voter.id]: votedFor?.id ?? null }));
  }

  const handleFinishLocalVoting = () => {
    const allVotes: Vote[] = activePlayers.map(p => ({
        voterId: p.id,
        votedForId: localVotes[p.id] !== undefined ? localVotes[p.id] : null
    }));
    onFinishLocalVoting(allVotes);
  };

  if (isLocalMode) {
     const commonUI = (
        <>
            <h2 className="text-3xl font-bold mb-4 text-center">Результаты и Обсуждение</h2>
            {shouldShowQuestion() && (
                <div className="w-full bg-slate-900/50 p-4 rounded-lg mb-6 text-center">
                    <p className="text-lg font-semibold text-slate-300">Вопрос:</p>
                    <p className="text-2xl text-cyan-400 font-bold">{question.text}</p>
                </div>
            )}
            <div className="space-y-3 w-full max-w-md mb-6">
                <h3 className="text-xl text-white font-semibold text-center mb-2">Ответы игроков</h3>
                {activePlayers.map(player => (
                    <div key={player.id} className="flex items-center justify-between bg-slate-700 p-4 rounded-lg gap-4">
                        <div className="flex items-center gap-3 flex-shrink-0">
                           <Avatar avatar={player.avatar} className="w-8 h-8" />
                           <span className="text-xl font-bold text-white">{player.name}</span>
                        </div>
                        <span className="text-xl font-medium text-cyan-300 bg-slate-800 px-3 py-1 rounded text-right flex-grow truncate">{getAnswerForPlayer(player.id)}</span>
                    </div>
                ))}
            </div>
        </>
     );
     
     if (isDiscussionOnly) {
         return (
            <div className="flex flex-col items-center">
                {commonUI}
                <button onClick={onProceedToVote} className="w-full mt-6 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl transition-transform transform hover:scale-105">
                    Перейти к голосованию
                </button>
            </div>
        );
     }
     
     if (localSequentialVoter) { // Sequential voting mode
        return (
            <div className="flex flex-col items-center">
                {commonUI}
                <div className="w-full max-w-lg">
                    <h3 className="text-xl text-white font-semibold text-center mb-2">Кто шпион?</h3>
                    <div className="mb-4 bg-slate-700 p-3 rounded-lg">
                        <p className="font-bold text-lg text-center mb-2">{localSequentialVoter.name} голосует за:</p>
                        <div className="flex justify-center flex-wrap gap-2">
                            {activePlayers.filter(p => p.id !== localSequentialVoter.id).map(votedFor => (
                                <button
                                    key={votedFor.id}
                                    onClick={() => onFinishLocalSequentialVote({ voterId: localSequentialVoter.id, votedForId: votedFor.id })}
                                    className="px-4 py-2 rounded-lg font-semibold transition-colors bg-slate-600 hover:bg-red-700 text-white text-lg"
                                >
                                    {votedFor.name}
                                </button>
                            ))}
                             <button
                                onClick={() => onFinishLocalSequentialVote({ voterId: localSequentialVoter.id, votedForId: localSequentialVoter.id })}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-red-800 hover:bg-red-700 text-white text-lg"
                            >
                                За себя
                            </button>
                            <button
                                onClick={() => onFinishLocalSequentialVote({ voterId: localSequentialVoter.id, votedForId: null })}
                                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-slate-600 hover:bg-slate-500 text-white text-lg"
                            >
                                Пропустить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
     } else { // Host-led voting mode
        return (
            <div className="flex flex-col items-center">
                {commonUI}
                <div className="w-full max-w-lg">
                    <h3 className="text-xl text-white font-semibold text-center mb-2">Кто шпион?</h3>
                    {activePlayers.map(voter => (
                        <div key={voter.id} className="mb-4 bg-slate-700 p-3 rounded-lg">
                            <p className="font-bold text-lg text-center mb-2">{voter.name} голосует за:</p>
                            <div className="flex justify-center flex-wrap gap-2">
                                {activePlayers.filter(p => p.id !== voter.id).map(votedFor => (
                                    <button
                                        key={votedFor.id}
                                        onClick={() => handleLocalVote(voter, votedFor)}
                                        className={`px-3 py-1 rounded font-semibold transition-colors
                                            ${localVotes[voter.id] === votedFor.id ? 'bg-red-600 text-white' : 'bg-slate-600 hover:bg-red-700 text-white'}`}
                                    >
                                        {votedFor.name}
                                    </button>
                                ))}
                                <button
                                    key={`${voter.id}-self`}
                                    onClick={() => handleLocalVote(voter, voter)}
                                    className={`px-3 py-1 rounded font-semibold transition-colors text-white ${localVotes[voter.id] === voter.id ? 'bg-red-700' : 'bg-red-800 hover:bg-red-700'}`}
                                >
                                    За себя
                                </button>
                                <button
                                  onClick={() => handleLocalVote(voter, null)}
                                  className={`px-3 py-1 rounded font-semibold transition-colors ${localVotes[voter.id] === null ? 'bg-slate-800 ring-2 ring-slate-400 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white'}`}
                                >
                                  Пропустить
                                </button>
                            </div>
                        </div>
                    ))}
                    <button onClick={handleFinishLocalVoting} className="w-full mt-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl">
                        Подсчитать голоса
                    </button>
                </div>
            </div>
         )
     }
  }

  // Online Mode Render
  const localPlayer = players.find(p => p.id === localPlayerId);
  const isSpectator = !!localPlayer?.isEliminated;
  const localPlayerHasVoted = hasVoted(localPlayerId);

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-4 text-center">Результаты и Обсуждение</h2>
      {shouldShowQuestion() && (
          <div className="w-full bg-slate-900/50 p-4 rounded-lg mb-6 text-center">
            <p className="text-lg font-semibold text-slate-300">Вопрос:</p>
            <p className="text-2xl text-cyan-400 font-bold">{question.text}</p>
          </div>
      )}
      
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
            <h3 className="text-xl text-white font-semibold text-center mb-2">Ответы игроков</h3>
            {activePlayers.map(player => (
            <div key={player.id} className="flex items-center justify-between bg-slate-700 p-4 rounded-lg gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Avatar avatar={player.avatar} className="w-8 h-8" />
                    <span className="text-xl font-bold text-white flex items-center gap-2">
                        {player.name}
                        {votingEnabled && (
                            <div title={hasVoted(player.id) ? "Проголосовал(а)" : "Голосует..."}>
                                {hasVoted(player.id) ? (
                                    <CheckIcon className="w-5 h-5 text-green-400" />
                                ) : (
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-full animate-pulse"></div>
                                    </div>
                                )}
                            </div>
                        )}
                        {player.connectionStatus === 'disconnected' && <WarningIcon className="w-5 h-5 text-yellow-400" title="Игрок отключился" />}
                         {isHost && !player.isHost && (
                            <>
                                <button onClick={() => onTransferHost(player.id)} className="text-yellow-400 hover:text-yellow-300" title="Передать хоста">
                                    <KeyIcon className="h-5 w-5" />
                                </button>
                                <button onClick={() => onKickPlayer(player.id)} className="text-red-400 hover:text-red-300" title="Исключить">
                                    <CrossIcon className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </span>
                </div>
                <span className="text-xl font-medium text-cyan-300 bg-slate-800 px-3 py-1 rounded text-right flex-grow truncate">{getAnswerForPlayer(player.id)}</span>
            </div>
            ))}
        </div>

        {votingEnabled && (
            <div className="space-y-3">
                <h3 className="text-xl text-white font-semibold text-center mb-2">Голосование</h3>
                {!isLocalMode && <Timer expiryTimestamp={timerEnd} onExpire={() => { if(isHost) onTally() }} />}
                
                {isSpectator && <p className="text-slate-400 text-center bg-slate-800 p-3 rounded-lg">Вы выбыли и не можете голосовать.</p>}

                {activePlayers.filter(p => p.id !== localPlayerId).map(player => (
                    <button
                        key={player.id}
                        onClick={() => onVote(player.id)}
                        disabled={localPlayerHasVoted || isSpectator}
                        className={`w-full text-left text-lg font-semibold p-4 rounded-lg transition-all duration-200 flex items-center gap-3
                            ${localPlayerHasVoted || isSpectator ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-red-700 text-white'}
                            ${player.connectionStatus === 'disconnected' ? 'opacity-50' : ''}`}
                    >
                        <Avatar avatar={player.avatar} className="w-8 h-8" />
                        <span className="flex-grow">{player.name}</span>
                         <div className="flex items-center gap-2">
                            {player.connectionStatus === 'disconnected' && <WarningIcon className="w-5 h-5 text-yellow-400" title="Игрок отключился" />}
                        </div>
                    </button>
                ))}
                {!isSpectator && (
                    <button
                        onClick={() => onVote(localPlayerId)}
                        disabled={localPlayerHasVoted}
                        className={`w-full text-left text-lg font-semibold p-4 rounded-lg transition-all duration-200 flex items-center gap-3
                            ${localPlayerHasVoted ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-red-800 hover:bg-red-700 text-white'}`}
                    >
                        <Avatar avatar={localPlayer?.avatar} className="w-8 h-8" />
                        <span className="flex-grow">Проголосовать за себя ({localPlayer?.name})</span>
                    </button>
                )}
                 <button
                    onClick={() => onVote(null)}
                    disabled={localPlayerHasVoted || isSpectator}
                    className={`w-full text-center text-lg font-semibold p-4 rounded-lg transition-all duration-200
                        ${localPlayerHasVoted || isSpectator ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-500 text-white'}`}
                >
                    Пропустить голосование
                </button>
                 {isHost && (
                    <button
                        onClick={onTally}
                        className="w-full text-center text-lg font-semibold p-4 rounded-lg transition-all duration-200 bg-yellow-600 hover:bg-yellow-500 text-white mt-4"
                    >
                        {noTimer ? 'Подсчитать голоса' : 'Завершить досрочно'}
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};