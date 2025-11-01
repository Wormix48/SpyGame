import React, { useState, useEffect, useMemo } from 'react';
import { Player, Vote } from '../types';
import { CrossIcon, WarningIcon } from './icons';
import { Avatar } from './Avatar';

interface VoteRevealScreenProps {
  eliminatedPlayer: Player | null;
  votes: Vote[];
  players: Player[];
  onContinue: () => void;
  isHost: boolean;
  isLocalMode: boolean;
  anonymousVoting: boolean;
}

const AshEffect: React.FC = () => {
    const particles = useMemo(() => {
        const p = [];
        const numParticles = 100;
        for (let i = 0; i < numParticles; i++) {
            p.push({
                '--dx': `${(Math.random() - 0.5) * 100}px`,
                '--size': `${2 + Math.random() * 4}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${0.2 + Math.random() * 0.5}s`,
            } as React.CSSProperties);
        }
        return p;
    }, []);

    return (
        <div className="absolute inset-0 z-10 overflow-hidden rounded-xl">
            {particles.map((style, i) => (
                <div key={i} className="ash-particle" style={style} />
            ))}
        </div>
    );
};

export const VoteRevealScreen: React.FC<VoteRevealScreenProps> = ({ eliminatedPlayer, votes, players, onContinue, isHost, isLocalMode, anonymousVoting }) => {
  const getPlayer = (id: string): Player | undefined => players.find(p => p.id === id);
  const [startBurnEffect, setStartBurnEffect] = useState(false);

  useEffect(() => {
      if (eliminatedPlayer) {
          const timer = setTimeout(() => {
              setStartBurnEffect(true);
          }, 1500); // Wait 1.5s before starting the effect
          return () => clearTimeout(timer);
      }
  }, [eliminatedPlayer]);

  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      {eliminatedPlayer ? (
        <>
          <h2 className="text-3xl font-bold mb-4">Игрок исключен!</h2>
          <div className="relative w-64 h-96 mb-6">
            {startBurnEffect && <AshEffect />}
            <div className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center p-6 border-2 shadow-lg ${eliminatedPlayer.isSpy ? 'bg-red-900/50 border-red-500 shadow-red-500/20' : 'bg-green-900/50 border-green-500 shadow-green-500/20'} ${startBurnEffect ? 'card-burn-out' : ''}`}>
              <CrossIcon className="absolute -top-5 -right-5 w-12 h-12 bg-slate-800 rounded-full p-2 text-red-500" />
              <Avatar avatar={eliminatedPlayer.avatar} className="w-24 h-24" />
              <p className="text-3xl font-bold mt-4 text-white player-name-reveal-spy" data-is-spy={eliminatedPlayer.isSpy}>{eliminatedPlayer.name}</p>
              <p className={`text-2xl font-semibold mt-2 ${eliminatedPlayer.isSpy ? 'text-red-400' : 'text-green-400'}`}>
                был(а) {eliminatedPlayer.isSpy ? 'ШПИОНОМ' : 'ОБЫЧНЫМ ИГРОКОМ'}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-3xl font-bold mb-4">{votes.length > 0 ? 'Ничья!' : 'Никто не голосовал'}</h2>
          <p className="text-xl text-slate-300 mb-6">Игроки не смогли прийти к единому мнению. Никто не выбывает в этом раунде.</p>
        </>
      )}

      {!anonymousVoting && votes.length > 0 && (
          <div className="w-full max-w-md">
            <h3 className="text-xl font-semibold mb-3">Детали голосования:</h3>
            <div className="space-y-2 text-left">
                {votes.map((vote, index) => {
                    const voter = getPlayer(vote.voterId);
                    const votedFor = vote.votedForId ? getPlayer(vote.votedForId) : null;
                    if (!voter) return null;
                    return (
                        <div key={index} className="bg-slate-700 p-2 rounded-md grid grid-cols-3 gap-2 text-center items-center">
                            <span className="text-slate-300 text-left flex items-center gap-2 truncate">
                                <Avatar avatar={voter.avatar} className="w-6 h-6 flex-shrink-0" />
                                <span className="truncate player-name-reveal-spy" data-is-spy={voter.isSpy}>{voter.name}</span>
                                {voter.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился" />}
                            </span>
                            {votedFor ? (
                                <>
                                    <span className="font-bold text-white text-sm">за</span>
                                    <span className="text-cyan-400 text-right flex items-center justify-end gap-2 truncate">
                                        <span className="truncate player-name-reveal-spy" data-is-spy={votedFor.isSpy}>{votedFor.name}</span>
                                        {votedFor.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился" />}
                                        <Avatar avatar={votedFor.avatar} className="w-6 h-6 flex-shrink-0" />
                                    </span>
                                </>
                            ) : (
                                <span className="font-bold text-slate-400 col-span-2 text-center">пропустил(а)</span>
                            )}
                        </div>
                    );
                })}
            </div>
          </div>
      )}
      
      {isHost || isLocalMode ? (
        <button
            onClick={() => onContinue()}
            className="mt-8 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
        >
            Следующий раунд
        </button>
      ) : (
        <p className="mt-8 text-slate-300 text-lg">Ожидание хоста для начала следующего раунда...</p>
      )}
    </div>
  );
};