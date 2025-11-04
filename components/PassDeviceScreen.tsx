import React from 'react';
interface PassDeviceScreenProps {
  nextPlayerName: string;
  onReady: () => void;
  title: string;
  instruction: string;
}
export const PassDeviceScreen: React.FC<PassDeviceScreenProps> = ({ nextPlayerName, onReady, title, instruction }) => {
  const handleReady = () => {
    onReady();
  }
  return (
    <div className="flex flex-col items-center justify-center text-center animate-fade-in min-h-[450px]">
      <h2 className="text-3xl font-bold text-white mb-6">{title}</h2>
      <p className="text-slate-300 mb-8 text-xl">{instruction}</p>
      <div className="w-full max-w-sm bg-slate-700 rounded-xl p-8 border-2 border-slate-600">
        <p className="text-white text-center text-3xl font-bold p-2 rounded-lg">{nextPlayerName}</p>
        <button
          onClick={handleReady}
          className="mt-6 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
        >
          Я готов(а)
        </button>
      </div>
    </div>
  );
};