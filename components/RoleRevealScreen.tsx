import React, { useState, useEffect } from 'react';
import { Player } from '../types';
import { SpyIcon, PlayerIcon, CheckIcon, CrossIcon, QuestionMarkIcon, KeyIcon, WarningIcon } from './icons';
import { Avatar } from './Avatar';

interface RoleRevealScreenProps {
  player: Player;
  onContinue: () => void;
  isHost: boolean;
  isLocalMode: boolean;
  players?: Player[];
  onAcknowledgeRole?: () => void;
  onKickPlayer?: (playerId: string) => void;
  onTransferHost?: (playerId: string) => void;
}

export const RoleRevealScreen: React.FC<RoleRevealScreenProps> = ({ player, onContinue, isHost, isLocalMode, players, onAcknowledgeRole, onKickPlayer, onTransferHost }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isFinished && isLocalMode) {
      const timer = setTimeout(onContinue, 1000); // 1s delay to show message
      return () => clearTimeout(timer);
    }
  }, [isFinished, isLocalMode, onContinue]);
  

  const handleReveal = () => {
    if (isRevealed) return; // Prevent re-triggering
    setIsRevealed(true);
  };
  
  const handleHide = () => {
    if (!isRevealed) return;
    if (!isLocalMode) {
        onAcknowledgeRole?.();
    }
    setIsFinished(true);
  };

  const handleClick = isRevealed ? handleHide : handleReveal;

  if (isFinished) {
    if (isLocalMode) {
      return (
        <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
          <h2 className="text-3xl font-bold text-white">Роль скрыта</h2>
        </div>
      );
    }

    // Online mode
    if (isHost) {
        const allAcknowledged = players?.every(p => p.roleAcknowledged || p.isEliminated || p.connectionStatus === 'disconnected');
        return (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
                <h2 className="text-3xl font-bold text-white mb-6">Роли распределены!</h2>
                <p className="text-slate-300 mb-4">Ожидание, пока все игроки ознакомятся со своей ролью.</p>
                <div className="w-full max-w-sm space-y-2 bg-slate-700 p-3 rounded-lg mb-6">
                    {players?.map(p => (
                        <div key={p.id} className={`flex items-center justify-between p-2 rounded-md transition-colors ${p.roleAcknowledged ? 'bg-green-600/50' : 'bg-slate-800'}`}>
                           <div className="flex items-center gap-2">
                                <Avatar avatar={p.avatar} className="w-6 h-6" />
                                <span className="font-semibold flex items-center gap-2">
                                  {p.name}
                                  {p.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился"/>}
                                </span>
                           </div>
                           <div className="flex items-center gap-2">
                                {p.roleAcknowledged ? (
                                   <CheckIcon className="w-6 h-6 text-green-300" />
                                ) : (
                                   <div className="w-6 h-6 flex items-center justify-center">
                                       <div className="w-3 h-3 bg-slate-500 rounded-full animate-pulse"></div>
                                   </div>
                                )}
                                {isHost && !p.isHost && (
                                    <>
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
                                    </>
                                )}
                           </div>
                        </div>
                    ))}
                </div>
                 <button
                    onClick={() => onContinue()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {allAcknowledged ? 'Начать игру' : 'Начать принудительно'}
                </button>
            </div>
        );
     }

    return (
      <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
        <h2 className="text-3xl font-bold text-white mb-6">Ожидание других игроков...</h2>
        <p className="text-slate-300 mb-8 text-center">Все роли распределены. Игра скоро начнется.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[450px]">
        <h2 className="text-2xl font-bold mb-4">Твоя роль, {player.name}</h2>
        <div className="perspective w-64 h-96" onClick={handleClick}>
            <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isRevealed ? 'rotate-y-180' : ''}`}>
                {/* Front of the card */}
                <div className="absolute w-full h-full backface-hidden bg-slate-700 rounded-xl flex flex-col items-center justify-center p-6 border-2 border-slate-600 shadow-lg cursor-pointer">
                    <Avatar avatar={player.avatar} className="w-24 h-24 mb-4" />
                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center my-4">
                            <QuestionMarkIcon className="w-16 h-16 text-cyan-400" />
                    </div>
                    <p className="mt-6 text-slate-300 animate-pulse">Нажми, чтобы перевернуть</p>
                </div>
                
                {/* Back of the card */}
                <div className={`absolute w-full h-full backface-hidden rounded-xl flex flex-col items-center justify-center p-6 border-2 shadow-lg rotate-y-180 cursor-pointer ${player.isSpy ? 'bg-red-900/50 border-red-500 shadow-red-500/20' : 'bg-green-900/50 border-green-500 shadow-green-500/20'}`}>
                    {player.isSpy ? (
                        <>
                            <SpyIcon className="w-24 h-24 text-red-500" />
                            <p className="text-4xl font-bold mt-4 text-red-400">ШПИОН</p>
                            <p className="mt-4 text-slate-300">Ты не будешь знать вопрос. Твоя задача - не выдать себя.</p>
                        </>
                    ) : (
                        <>
                            <PlayerIcon className="w-24 h-24 text-green-500" />
                            <p className="text-4xl font-bold mt-4 text-green-400">ИГРОК</p>
                            <p className="mt-4 text-slate-300">Ты будешь видеть вопрос. Твоя задача - вычислить шпиона.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
            {isRevealed && <p className="mt-6 text-slate-400 animate-pulse">Нажми, чтобы скрыть и продолжить</p>}
    </div>
  );
};