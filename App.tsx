import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameModeScreen } from './components/GameModeScreen';
import { LocalGame } from './components/LocalGame';
import { OnlineGame } from './components/OnlineGame';
import { HelpTooltip } from './components/HelpTooltip';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<'online' | 'local' | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [isDebugMenuOpen, setIsDebugMenuOpen] = useState(false);
  const onlineGameRef = useRef<{ cleanup: () => void } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomIdFromUrl = params.get('join');
    if (roomIdFromUrl) {
      setInitialRoomId(roomIdFromUrl);
      setGameMode('online');
    }
  }, []);

  const handleNewGame = useCallback(() => {
    // Clear the URL query string to avoid re-joining the same room on refresh
    if (window.location.search) {
      window.history.pushState({}, document.title, window.location.pathname);
    }
    setGameMode(null);
    setInitialRoomId(null);
  }, []);

  const renderGame = () => {
    switch(gameMode) {
      case 'online':
        return <OnlineGame onExit={handleNewGame} initialRoomId={initialRoomId} isDebugMenuOpen={isDebugMenuOpen} closeDebugMenu={() => setIsDebugMenuOpen(false)} />;
      case 'local':
        return <LocalGame onExit={handleNewGame} />;
      default:
        return <GameModeScreen onSelectMode={setGameMode} />;
    }
  }

  return (
    <main className="container mx-auto p-4 md:p-8 min-h-screen flex flex-col font-sans relative">
      <header className="relative w-full flex justify-center items-center mb-2 h-12">
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <HelpTooltip />
        </div>
        
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-cyan-400 tracking-wider text-center px-2 whitespace-nowrap">
          НАЙДИ ШПИОНА
        </h1>
      </header>
      
      {gameMode && (
        <div className="w-full max-w-4xl self-center flex justify-end mb-4">
           <button 
                onClick={handleNewGame}
                className="bg-slate-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-sm whitespace-nowrap transition-colors"
                aria-label="Выйти в меню"
            >
                Выйти в меню
            </button>
        </div>
      )}

      <div className="w-full max-w-4xl bg-slate-800 rounded-2xl shadow-2xl shadow-cyan-500/10 p-6 pb-24 md:p-8 self-center flex-grow">
        {renderGame()}
      </div>
      
      <div className="absolute bottom-4 right-4 flex items-center gap-4">
        <button onClick={() => setIsDebugMenuOpen(p => !p)} className="text-slate-500 text-xs focus:outline-none" aria-label="Открыть меню отладки">
            v2.3.0
        </button>
      </div>
    </main>
  );
};

export default App;