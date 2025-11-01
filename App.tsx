import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameModeScreen } from './components/GameModeScreen';
import { LocalGame } from './components/LocalGame';
import { OnlineGame, OnlineGameHandle } from './components/OnlineGame';
import { HelpTooltip } from './components/HelpTooltip';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<'online' | 'local' | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [isDebugMenuOpen, setIsDebugMenuOpen] = useState(false);
  const onlineGameRef = useRef<OnlineGameHandle | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomIdFromUrl = params.get('join');
    if (roomIdFromUrl) {
      setInitialRoomId(roomIdFromUrl);
      setGameMode('online');
    }
  }, []);

  useEffect(() => {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
    let keySequence: string[] = [];

    const handler = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        keySequence.push(e.key);
        keySequence = keySequence.slice(-code.length);

        if (keySequence.join('') === code.join('')) {
            document.body.classList.toggle('spy-reveal-mode');
            keySequence = []; // Reset
        }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNewGame = useCallback(() => {
    // If we are in online mode, trigger the cleanup function before resetting the app state
    if (gameMode === 'online' && onlineGameRef.current) {
        onlineGameRef.current.cleanup();
    }

    // Reset the app state to go back to the main menu
    if (window.location.search) {
        window.history.pushState({}, document.title, window.location.pathname);
    }
    setGameMode(null);
    setInitialRoomId(null);
  }, [gameMode]);

  const renderGame = () => {
    switch(gameMode) {
      case 'online':
        return <OnlineGame ref={onlineGameRef} onExit={handleNewGame} initialRoomId={initialRoomId} isDebugMenuOpen={isDebugMenuOpen} closeDebugMenu={() => setIsDebugMenuOpen(false)} />;
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
          ИГРА В ШПИОНА
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
        <div onDoubleClick={() => setIsDebugMenuOpen(p => !p)} className="text-slate-500 text-xs focus:outline-none cursor-default select-none" aria-label="Открыть меню отладки (двойной клик)">
            v2.5.0
        </div>
      </div>
    </main>
  );
};

export default App;