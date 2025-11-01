import React from 'react';
import { Player } from '../types';
import { SpyIcon, PlayerIcon } from './icons';
import { Avatar } from './Avatar';

interface GameOverScreenProps {
  winner: 'PLAYERS' | 'SPIES';
  players: Player[];
  onNewGame: () => void;
  onReplay: () => void;
  isHost: boolean;
  isLocalMode: boolean;
  customMessage?: string;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, players, onNewGame, onReplay, isHost, isLocalMode, customMessage }) => {
  const spies = players.filter(p => p.isSpy);
  const survivors = players.filter(p => !p.isEliminated && !p.isSpy);

  const renderWinnerCard = () => {
    if (winner === 'PLAYERS') {
      return (
        <div className="relative w-64 h-96 rounded-xl flex flex-col items-center justify-start p-4 border-2 shadow-lg bg-green-900/50 border-green-500 shadow-green-500/20 player-win-card">
          <PlayerIcon className="w-16 h-16 text-green-400 mt-2" />
          <h3 className="text-2xl font-bold text-white mt-2">ПОБЕДИТЕЛИ</h3>
          <div className="w-full h-px bg-green-500/50 my-2"></div>
          <div className="w-full overflow-y-auto space-y-2 pr-1">
            {survivors.map(player => (
              <div key={player.id} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-md">
                <Avatar avatar={player.avatar} className="w-8 h-8" />
                <span className="text-lg font-semibold text-white truncate player-name-reveal-spy" data-is-spy={player.isSpy}>{player.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (winner === 'SPIES') {
      return (
        <div className="relative w-64 h-96 rounded-xl flex flex-col items-center justify-start p-4 border-2 shadow-lg bg-red-900/50 spy-win-card">
           <div className="relative z-10 flex flex-col items-center w-full">
            <SpyIcon className="w-16 h-16 text-red-400 mt-2" />
            <h3 className="text-2xl font-bold text-white mt-2">ШПИОНЫ</h3>
            <div className="w-full h-px bg-red-500/50 my-2"></div>
            <div className="w-full overflow-y-auto space-y-2 pr-1 max-h-48">
              {spies.length > 0 ? spies.map(spy => (
                <div key={spy.id} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-md">
                  <Avatar avatar={spy.avatar} className="w-8 h-8" />
                  <span className="text-lg font-semibold text-white truncate player-name-reveal-spy" data-is-spy={spy.isSpy}>{spy.name}</span>
                </div>
              )) : <p className="text-slate-400 text-center">Шпионов не было в этой игре.</p>}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      {customMessage ? (
        <h2 className="text-5xl font-extrabold mb-2 text-red-500">
            Игра Окончена
        </h2>
      ) : (
        <h2 className="text-5xl font-extrabold mb-2 animate-bounce">
            {winner === 'PLAYERS' ? 'ПОБЕДА ИГРОКОВ!' : 'ШПИОНЫ ПОБЕДИЛИ!'}
        </h2>
      )}
      <p className="text-xl text-slate-300 mb-6">
        {customMessage || (winner === 'PLAYERS' ? 'Все шпионы были найдены!' : 'Шпионы смогли обмануть всех!')}
      </p>

      {renderWinnerCard()}
      
      <div className="flex items-center justify-center gap-4 mt-8 w-full">
         {(isHost || isLocalMode) && (
             <button
                onClick={() => onReplay()}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
             >
                {isLocalMode ? 'Изменить настройки' : 'Вернуться в лобби'}
             </button>
         )}
         <button
            onClick={() => onNewGame()}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
         >
            Новая игра
         </button>
      </div>
    </div>
  );
};
