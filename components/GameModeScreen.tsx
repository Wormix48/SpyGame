import React from 'react';

interface GameModeScreenProps {
  onSelectMode: (mode: 'online' | 'local') => void;
}

export const GameModeScreen: React.FC<GameModeScreenProps> = ({ onSelectMode }) => {

  const handleSelect = (mode: 'online' | 'local') => {
    onSelectMode(mode);
  }

  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[450px]">
      <h2 className="text-3xl font-bold text-white mb-8">Выберите режим игры</h2>
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-md">
        <button
          onClick={() => handleSelect('online')}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-6 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
        >
          Играть по сети
        </button>
        <button
          onClick={() => handleSelect('local')}
          className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-6 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
        >
          Играть на одном устройстве
        </button>
      </div>
      <p className="text-slate-400 mt-8 max-w-lg">
        <b>Играть по сети:</b> каждый играет со своего устройства.
        <br />
        <b>Играть на одном устройстве:</b> все играют по очереди на одном телефоне или планшете.
      </p>
    </div>
  );
};