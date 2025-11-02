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
  revealVotes?: boolean;
  
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
    isDiscussionOnly = false, onProceedToVote = () => {}, showQuestionToSpy = true, revealVotes = false
}) => {
  const [localVotes, setLocalVotes] = useState<Record<string, string | null>>({});

  const getVoteForPlayer = (playerId: string) => {
    const vote = votes.find(v => v.voterId === playerId);
    if (!vote) return null;
    if (vote.votedForId === null) return 'Пропустил';
    return players.find(p => p.id === vote.votedForId)?.name || 'Неизвестно';
  };

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
    return (answers || []).find(a => a.playerId === playerId)?.answer || 'Нет ответа';
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
                           <span className="text-xl font-bold text-white player-name-reveal-spy" data-is-spy={player.isSpy}>{player.name}</span>
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
                        <p className="font-bold text-lg text-center mb-2 player-name-reveal-spy" data-is-spy={localSequentialVoter.isSpy}>{localSequentialVoter.name} голосует за:</p>
                        <div className="flex justify-center flex-wrap gap-2">
                            {activePlayers.filter(p => p.id !== localSequentialVoter.id).map(votedFor => (
                                <button
                                    key={votedFor.id}
                                    onClick={() => onFinishLocalSequentialVote({ voterId: localSequentialVoter.id, votedForId: votedFor.id })}
                                    className="px-4 py-2 rounded-lg font-semibold transition-colors bg-slate-600 hover:bg-red-700 text-white text-lg"
                                >
                                    <span className="player-name-reveal-spy" data-is-spy={votedFor.isSpy}>{votedFor.name}</span>
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
                            <p className="font-bold text-lg text-center mb-2 player-name-reveal-spy" data-is-spy={voter.isSpy}>{voter.name} голосует за:</p>
                            <div className="flex justify-center flex-wrap gap-2">
                                {activePlayers.filter(p => p.id !== voter.id).map(votedFor => (
                                    <button
                                        key={votedFor.id}
                                        onClick={() => handleLocalVote(voter, votedFor)}
                                        className={`px-3 py-1 rounded font-semibold transition-colors
                                            ${localVotes[voter.id] === votedFor.id ? 'bg-red-600 text-white' : 'bg-slate-600 hover:bg-red-700 text-white'}`}
                                    >
                                        <span className="player-name-reveal-spy" data-is-spy={votedFor.isSpy}>{votedFor.name}</span>
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
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-4 text-center">Результаты и Обсуждение</h2>
        {shouldShowQuestion() && (
            <div className="w-full bg-slate-900/50 p-4 rounded-lg mb-6 text-center">
              <p className="text-lg font-semibold text-slate-300">Вопрос:</p>
              <p className="text-2xl text-cyan-400 font-bold">{question.text}</p>
            </div>
        )}
        
        {/* Таймер */}
        {votingEnabled && !isLocalMode && <Timer expiryTimestamp={timerEnd} onExpire={() => { if(isHost) onTally() }} />}
        {isSpectator && <p className="text-slate-400 text-center bg-slate-800 p-3 rounded-lg mb-4">Вы выбыли и не можете голосовать.</p>}

        {/* Блоки ответов и голосования (обновленный дизайн) */}
        <div className="w-full space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-center text-xl font-bold text-slate-300 mb-2">
            <div className="text-left p-4">Ответы</div>
            <div className="text-center p-4">Голосование</div>
          </div>

          {/* Строки с игроками */}
          {activePlayers.map(player => {
              if (!player) return null;
              const voted = hasVoted(player.id);
              return (
                                <div key={player.id} className="grid grid-cols-2 gap-4">
                                    {/* Левая часть: Игрок и Ответ */}
                                    <div className="flex flex-col items-start p-4 gap-2 relative bg-slate-700 rounded-xl shadow-lg border border-slate-600 overflow-hidden hover:bg-slate-600 transition-colors">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <Avatar avatar={player.avatar} className="w-8 h-8" />
                                                <span className="text-xl font-bold text-white player-name-reveal-spy" data-is-spy={player.isSpy}>{player.name}</span>
                                                {votingEnabled && revealVotes && hasVoted(player.id) && (
                                                    <span className="text-sm text-yellow-400 font-medium">(за: {getVoteForPlayer(player.id)})</span>
                                                )}
                                            </div>
                                        
                                            <div className="flex items-center space-x-2">
                                                {/* Галочка справа от имени */}
                                                {voted && <CheckIcon className="w-6 h-6 text-green-400" title="Проголосовал(а)" />}
              
                                                {/* Admin/Disconnect controls */}
                                                {player.connectionStatus === 'disconnected' && <WarningIcon className="w-5 h-5 text-yellow-400" title="Игрок отключился" />}
                                                {isHost && !player.isHost && !player.id.startsWith('BOT-') && (
                                                    <>
                                                        <button onClick={() => onTransferHost(player.id)} className="text-yellow-400 hover:text-yellow-300" title="Передать хоста">
                                                            <KeyIcon className="h-5 w-5" />
                                                        </button>
                                                        <button onClick={() => onKickPlayer(player.id)} className="text-red-400 hover:text-red-300" title="Исключить">
                                                            <CrossIcon className="h-5 w-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-lg font-medium text-cyan-300 bg-slate-800 px-3 py-1 rounded w-full truncate">{getAnswerForPlayer(player.id)}</span>
                                    </div>
                                    {/* Столбец 2: Кнопка голосования / Статус */}
                                    <div className="flex items-stretch justify-center p-0">
                                                      {votingEnabled ? (
                                                          player.id === localPlayerId ? (
                                                              <button
                                                                  onClick={() => onVote(localPlayerId)}
                                                                  disabled={localPlayerHasVoted || isSpectator}
                                                                  className={`w-full h-full text-center text-lg font-semibold p-3 transition-all duration-200 flex items-center justify-center
                                                                      ${localPlayerHasVoted || isSpectator ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-red-800 hover:bg-red-700 text-white'} rounded-xl shadow-lg border border-slate-600`}
                                                              >
                                                                  Голосовать за себя
                                                              </button>
                                                          ) : (
                                                              <button
                                                                  onClick={() => onVote(player.id)}
                                                                  disabled={localPlayerHasVoted || isSpectator}
                                                                  className={`w-full h-full text-center text-lg font-semibold p-3 transition-all duration-200 flex items-center justify-center
                                                                      ${localPlayerHasVoted || isSpectator ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-red-700 text-white'} rounded-xl shadow-lg border border-slate-600`}
                                                              >
                                                                  Голосовать за {player.name}
                                                              </button>
                                                          )
                                                      ) : (
                                                          <div className="flex items-center gap-2 text-lg font-semibold text-slate-400 h-full w-full justify-center">
                                                              {hasVoted(player.id) ? (
                                                                  <>
                                                                      <CheckIcon className="w-6 h-6 text-green-400" />
                                                                      <span>Проголосовал(а)</span>
                                                                  </>
                                                              ) : (
                                                                  <>
                                                                      <div className="w-3 h-3 bg-slate-500 rounded-full animate-pulse"></div>
                                                                      <span>Ожидание...</span>
                                                                  </>
                                                              )}
                                                              {revealVotes && hasVoted(player.id) && (
                                                                  <span className="text-sm text-yellow-400">(за: {getVoteForPlayer(player.id)})</span>
                                                              )}
                                                          </div>
                                                      )}
                                                  </div>
              </div>
              );
          })}

        </div>

        {/* Дополнительные кнопки голосования (отдельный блок) */}
        {votingEnabled && !isSpectator && (
          <div className="w-full max-w-md flex flex-col gap-3 mt-6">
              <button
                  onClick={() => onVote(null)}
                  disabled={localPlayerHasVoted}
                  className={`w-full text-center text-lg font-semibold p-4 rounded-lg transition-all duration-200
                      ${localPlayerHasVoted ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-500 text-white'}`}
              >
                  Пропустить голосование
              </button>
              {isHost && (
                  <button
                      onClick={onTally}
                      className="w-full text-center text-lg font-semibold p-4 rounded-lg transition-all duration-200 bg-yellow-600 hover:bg-yellow-500 text-white"
                  >
                      {noTimer ? 'Подсчитать голоса' : 'Завершить досрочно'}
                  </button>
              )}
          </div>
        )}
      </div>
    );
};