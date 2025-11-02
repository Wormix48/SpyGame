import React, { useState, useEffect } from 'react';
import { Player, Question, Answer } from '../types';
import { CheckIcon, WarningIcon, CrossIcon, KeyIcon } from './icons';
import { Avatar } from './Avatar';

interface AnsweringScreenProps {
  player: Player;
  players: Player[]; // Empty in local mode
  question: Question;
  answers: Answer[]; // Empty in local mode
  onSubmit: (answer: string) => void;
  timerEnd: number | null;
  isLocalMode: boolean;
  isHost?: boolean;
  noTimer?: boolean;
  onForceEndAnswering?: () => void;
  onKickPlayer?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;
  showQuestionToSpy?: boolean;
  isSendingAnswer?: boolean;
  hideAnswerStatus?: boolean;
}

const Timer: React.FC<{ expiryTimestamp: number | null }> = ({ expiryTimestamp }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        if (!expiryTimestamp) return;

        const calculateTimeLeft = () => {
            const diff = expiryTimestamp - Date.now();
            return Math.round(Math.max(0, diff) / 1000);
        }

        setTimeLeft(calculateTimeLeft());
        const interval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(interval);
    }, [expiryTimestamp]);

    if (!expiryTimestamp || timeLeft <= 0) return null;

    return (
        <div className="absolute top-4 left-4 bg-slate-900/80 rounded-full w-14 h-14 flex items-center justify-center border-2 border-cyan-500">
            <span className="text-cyan-400 text-2xl font-bold">{timeLeft}</span>
        </div>
    );
};

export const AnsweringScreen: React.FC<AnsweringScreenProps> = ({ player, players, question, answers, onSubmit, timerEnd, isLocalMode, isHost, noTimer, onForceEndAnswering, onKickPlayer, onTransferHost, showQuestionToSpy = true, isSendingAnswer = false, hideAnswerStatus = false }) => {
  const [hasAnswered, setHasAnswered] = useState(false);
  const [awaitingAcknowledgement, setAwaitingAcknowledgement] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

    useEffect(() => {

        if (!isLocalMode && player) {

            const answered = (answers || []).some(a => a.playerId === player.id);

            if (answered) {

              setHasAnswered(answered);

              setAwaitingAcknowledgement(false);

            }

        }

    }, [answers, player, isLocalMode]);

    

    const handleAnswerSelect = (answer: string) => {

      if (hasAnswered) return;

      setHasAnswered(true);

      setSelectedAnswer(answer);

      if (isLocalMode) {

        setAwaitingAcknowledgement(true);

      }

      else {

        onSubmit(answer); // Call submit immediately for online mode

      }

    };

    

    const handleAcknowledgementClick = () => {

      if (!awaitingAcknowledgement) return;

      if (isLocalMode && selectedAnswer) {

        onSubmit(selectedAnswer);

      }

      else {

        // For online mode, this is no longer the primary path

        setAwaitingAcknowledgement(false);

      }

    };

    

    const answerOptions = question.answers;

  

        if (!player || player.isEliminated) {

  

          return (

  

              <div className="relative flex flex-col items-center text-center animate-fade-in">

  

                  {!isLocalMode && <Timer expiryTimestamp={timerEnd} />}

  

                  <div className="min-h-[150px] flex flex-col items-center justify-center">

  

                      <h2 className="text-3xl font-bold text-slate-400 mt-4">Вы выбыли из игры</h2>

  

                      <p className="text-slate-300 mt-2">Вы можете наблюдать за ходом раунда.</p>

  

                  </div>

              

                            {player && player.isSpy ? (

              

                                <div className="bg-red-900/50 p-4 rounded-lg my-4 border border-red-500 w-full">

              

                                    <p className="text-lg font-bold text-red-300">ВЫ БЫЛИ ШПИОНОМ</p>

              

                                    <p className="text-slate-300">Вопрос скрыт.</p>

              

                                </div>

              

                            ) : (

              

                                <div className="bg-green-900/50 p-4 rounded-lg my-4 border border-green-500 w-full">

              

                                    <p className="text-lg font-bold text-green-300">ВОПРОС:</p>

              

                                    <p className="text-xl text-white">{question.text}</p>

              

                                </div>

              

                            )}

  

              {!isLocalMode && (

                  <div className="mt-8 w-full">

                      {!hideAnswerStatus && <h3 className="text-xl font-semibold mb-4 text-center">Статус ответов:</h3>}

                      <div className="flex flex-wrap justify-center gap-2">

                          {players.map(p => {

                              const pHasAnswered = (answers || []).some(a => a.playerId === p.id);

                              const statusClasses = hideAnswerStatus ? 'bg-slate-600 text-slate-300' : (pHasAnswered ? 'bg-green-500/80 text-white' : 'bg-slate-600 text-slate-300');

                              return (

                                  <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusClasses}`}>

                                      <Avatar avatar={p.avatar} className="w-5 h-5" />

                                      <span className="font-semibold player-name-reveal-spy" data-is-spy={p.isSpy}>{p.name}</span>

                                      {!hideAnswerStatus && pHasAnswered && '✓'}

                                      {p.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился" />}

                                  </div>

                              );

                          })}

                                            </div>

                                        </div>

                                    )}

                                    

                                    {isHost && !isLocalMode && (

                                        <div className="text-center mt-4 w-full">

                                            <button onClick={() => onForceEndAnswering?.()} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105">

                                                {noTimer ? 'Завершить прием ответов' : 'Завершить досрочно'}

                                            </button>

                                        </div>

                                    )}

                                </div>

                            );

    }

  const MainContent = () => {
      if (awaitingAcknowledgement) {
          return (
            <div 
              className="min-h-[450px] flex flex-col items-center justify-center w-full cursor-pointer animate-fade-in"
              onClick={handleAcknowledgementClick}
              role="button"
              tabIndex={0}
              aria-label="Нажмите, чтобы продолжить"
            >
              <CheckIcon className="w-24 h-24 text-green-500" />
              <h2 className="text-3xl font-bold text-white mt-4">Ответ принят!</h2>
              {player.isSpy && showQuestionToSpy && (
                  <div className="bg-slate-900/50 p-4 rounded-lg mt-6 border border-cyan-500 w-full max-w-lg text-center animate-fade-in">
                      <p className="text-lg font-bold text-cyan-300">ВОПРОС БЫЛ:</p>
                      <p className="text-xl text-white">{question.text}</p>
                  </div>
              )}
              <p className="text-slate-300 mt-8 animate-pulse text-lg">Нажмите, чтобы продолжить</p>
            </div>
          );
      }

      if (hasAnswered) { // Online mode only, after acknowledgement
          return (
              <div className="min-h-[350px] flex flex-col items-center justify-center w-full">
                  {isSendingAnswer ? (
                       <>
                          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mb-6"></div>
                          <h2 className="text-3xl font-bold text-white mt-4">Отправка...</h2>
                       </>
                  ) : (
                      <>
                          <CheckIcon className="w-24 h-24 text-green-500" />
                          <h2 className="text-3xl font-bold text-white mt-4">Ответ принят!</h2>
                          <p className="text-slate-300 mt-2">Ожидаем ответов от других игроков...</p>
                          {player.isSpy && showQuestionToSpy && (
                              <div className="bg-slate-900/50 p-4 rounded-lg mt-6 border border-cyan-500 w-full max-w-lg text-center animate-fade-in">
                                  <p className="text-lg font-bold text-cyan-300">ВОПРОС БЫЛ:</p>
                                  <p className="text-xl text-white">{question.text}</p>
                              </div>
                          )}
                      </>
                  )}
              </div>
          );
      }

      return (
          <>
              <div className="flex items-center justify-center gap-3 mb-2">
                  <Avatar avatar={player.avatar} className="w-10 h-10" />
                  <h2 className="text-2xl font-bold">Ваш ход, <span className="text-cyan-400">{player.name}</span></h2>
              </div>
              
              {player.isSpy ? (
              <div className="bg-red-900/50 p-4 rounded-lg my-4 border border-red-500 w-full">
                  <p className="text-lg font-bold text-red-300">ВЫ ШПИОН</p>
                  <p className="text-slate-300">Вопрос скрыт. Выберите один из вариантов ответа.</p>
              </div>
              ) : (
              <div className="bg-green-900/50 p-4 rounded-lg my-4 border border-green-500 w-full">
                  <p className="text-lg font-bold text-green-300">ВОПРОС:</p>
                  <p className="text-xl text-white">{question.text}</p>
              </div>
              )}
  
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 w-full max-w-lg">
              {answerOptions.map((ans, idx) => (
                  <button
                  key={idx}
                  onClick={() => handleAnswerSelect(ans)}
                  className="w-full bg-slate-700 hover:bg-cyan-600 text-white font-semibold py-4 px-4 rounded-lg transition-all duration-200 text-lg transform hover:scale-105"
                  >
                  {ans}
                  </button>
              ))}
              </div>
          </>
      );
  };

  return (
    <div className="relative flex flex-col items-center text-center animate-fade-in">
      {!isLocalMode && <Timer expiryTimestamp={timerEnd} />}
      
      <MainContent />
      
      {!isLocalMode && (
        <div className="mt-8 w-full">
            {!hideAnswerStatus && <h3 className="text-xl font-semibold mb-4 text-center">Статус ответов:</h3>}
            <div className="flex flex-wrap justify-center gap-2">
                {players.map(p => {
                    const pHasAnswered = (answers || []).some(a => a.playerId === p.id);
                    const statusClasses = hideAnswerStatus ? 'bg-slate-600 text-slate-300' : (pHasAnswered ? 'bg-green-500/80 text-white' : 'bg-slate-600 text-slate-300');
                    return (
                        <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 ${statusClasses}`}>
                            <Avatar avatar={p.avatar} className="w-5 h-5" />
                            <span className="font-semibold player-name-reveal-spy" data-is-spy={p.isSpy}>{p.name}</span>
                            {!hideAnswerStatus && pHasAnswered && '✓'}
                            {p.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился" />}
                            {isHost && !p.isHost && !p.id.startsWith('BOT-') && (
                                <div className="flex items-center gap-1 ml-auto">
                                    <button
                                        onClick={() => onTransferHost?.(p.id)}
                                        className="text-yellow-400 hover:text-yellow-300 p-0.5 rounded-full hover:bg-slate-800/50"
                                        aria-label={`Передать хоста ${p.name}`}
                                        title="Передать хоста"
                                    >
                                        <KeyIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onKickPlayer?.(p.id)}
                                        className="text-red-400 hover:text-red-300 p-0.5 rounded-full hover:bg-slate-800/50"
                                        aria-label={`Исключить ${p.name}`}
                                    >
                                        <CrossIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {isHost && (
                <div className="text-center mt-4">
                    <button onClick={() => onForceEndAnswering?.()} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105">
                        {noTimer ? 'Завершить прием ответов' : 'Завершить досрочно'}
                    </button>
                </div>
            )}
        </div>
      )}
    </div>
  );
};