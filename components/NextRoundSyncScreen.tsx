import React from 'react';
import { Player } from '../types';
import { Avatar } from './Avatar';
import { CheckIcon, CrossIcon, KeyIcon, WarningIcon } from './icons';

interface NextRoundSyncScreenProps {
  players: Player[];
  localPlayerId: string;
  isHost: boolean;
  onContinue: () => void;
  onReady: () => void;
  onKickPlayer: (playerId: string) => void;
  onTransferHost: (playerId: string) => void;
}

export const NextRoundSyncScreen: React.FC<NextRoundSyncScreenProps> = ({ players, localPlayerId, isHost, onContinue, onReady, onKickPlayer, onTransferHost }) => {
    const localPlayer = players.find(p => p.id === localPlayerId);

    React.useEffect(() => {
        if (localPlayer && !localPlayer.isEliminated && !localPlayer.readyForNextRound) {
            onReady();
        }
    }, [localPlayer, onReady]);

    const activePlayers = players.filter(p => !p.isEliminated);
    const allReady = activePlayers.filter(p => p.connectionStatus !== 'disconnected').every(p => p.readyForNextRound);
    
    if (isHost) {
        return (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
                <h2 className="text-3xl font-bold text-white mb-6">Подготовка к следующему раунду</h2>
                <p className="text-slate-300 mb-4">Ожидание, пока все игроки подтвердят готовность.</p>
                <div className="w-full max-w-sm space-y-2 bg-slate-700 p-3 rounded-lg mb-6">
                    {activePlayers.map(p => {
                        const isReady = p.readyForNextRound;
                        const isDisconnected = p.connectionStatus === 'disconnected';
                        
                        let backgroundClass = 'bg-slate-800'; // Waiting
                        if (isReady) {
                            backgroundClass = 'bg-green-600/50';
                        } else if (isDisconnected) {
                            backgroundClass = 'bg-slate-700 opacity-60';
                        }

                        return (
                            <div key={p.id} className={`flex items-center justify-between p-2 rounded-md transition-colors ${backgroundClass}`}>
                               <div className="flex items-center gap-2">
                                    <Avatar avatar={p.avatar} className="w-6 h-6" />
                                    <span className="font-semibold flex items-center gap-2">
                                      <span className="player-name-reveal-spy" data-is-spy={p.isSpy}>{p.name}</span>
                                      {isDisconnected && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился"/>}
                                    </span>
                               </div>
                               <div className="flex items-center gap-2">
                                    {isReady ? (
                                       <CheckIcon className="w-6 h-6 text-green-300" />
                                    ) : !isDisconnected ? (
                                       <div className="w-6 h-6 flex items-center justify-center">
                                           <div className="w-3 h-3 bg-slate-500 rounded-full animate-pulse"></div>
                                       </div>
                                    ) : null}
                                    {isHost && !p.isHost && (
                                        <>
                                            <button
                                                onClick={() => onTransferHost(p.id)}
                                                className="text-yellow-400 hover:text-yellow-300 p-0.5 rounded-full hover:bg-slate-800/50"
                                                aria-label={`Передать хоста ${p.name}`}
                                                title="Передать хоста"
                                            >
                                                <KeyIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onKickPlayer(p.id)}
                                                className="text-red-400 hover:text-red-300 p-0.5 rounded-full hover:bg-slate-800/50"
                                                aria-label={`Исключить ${p.name}`}
                                            >
                                                <CrossIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                               </div>
                            </div>
                        );
                    })}
                </div>
                 <button
                    onClick={onContinue}
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {allReady ? 'Следующий раунд' : 'Начать принудительно'}
                </button>
            </div>
        );
    }

    // Client view
    return (
        <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
             <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mb-6"></div>
             <h2 className="text-3xl font-bold text-white mb-6">Синхронизация...</h2>
             <p className="text-slate-300 mb-8 text-center">Подготовка к следующему раунду. Ожидаем хоста.</p>
        </div>
    );
};