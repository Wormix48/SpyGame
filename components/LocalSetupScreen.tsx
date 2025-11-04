import React, { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { QuestionSource } from '../types';
import { CrossIcon, DragHandleIcon, PencilIcon } from './icons';
import { Avatar } from './Avatar';
import { processImage, generateId } from '../utils';
import { ApiKeyModal } from './ApiKeyModal';
interface PlayerProfile {
  id: string;
  name: string;
  avatar: string | null;
}
interface LocalSetupScreenProps {
  onGameStart: (players: PlayerProfile[], spyCount: number, votingEnabled: boolean, questionSource: QuestionSource, familyFriendly: boolean, roundLimit: boolean, showQuestionToSpy: boolean, anonymousVoting: boolean) => void;
}
const SETTINGS_KEY = 'spy-game-local-settings';
const PlayerListItem = memo(({ player, index, editingIndex, editingName, onEdit, onSaveEdit, setEditingName, onRemove, onAvatarClick, onDragStart, onDragEnter, onDragEnd, onDragOver }: any) => {
    return (
        <div 
            className="flex items-center justify-between bg-slate-700 p-2 rounded-lg text-lg font-medium text-white cursor-grab transition-shadow duration-200"
            draggable onDragStart={(e) => onDragStart(e, index)} onDragEnter={(e) => onDragEnter(e, index)} onDragEnd={onDragEnd} onDragOver={onDragOver}
        >
            <div className="flex items-center gap-2 flex-grow min-w-0">
              <DragHandleIcon className="h-6 w-6 text-slate-400 flex-shrink-0" />
              <button onClick={() => onAvatarClick(player.id)} className="flex-shrink-0"><Avatar avatar={player.avatar} className="w-10 h-10" /></button>
              {editingIndex === index ? (
                <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={onSaveEdit} onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit() }} className="bg-slate-800 text-white p-1 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-cyan-500" autoFocus maxLength={15} />
              ) : (
                <span className="p-1 truncate">{player.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => onEdit(index)} className="text-cyan-400 hover:text-cyan-300 p-1"><PencilIcon className="h-5 w-5" /></button>
              <button onClick={() => onRemove(player.id)} className="text-red-400 hover:text-red-300 p-1"><CrossIcon className="h-6 w-6" /></button>
            </div>
        </div>
    );
});
export const LocalSetupScreen: React.FC<LocalSetupScreenProps> = ({ onGameStart }) => {
  const [players, setPlayers] = useState<PlayerProfile[]>([
    { id: generateId(), name: 'Игрок 1', avatar: null },
    { id: generateId(), name: 'Игрок 2', avatar: null },
    { id: generateId(), name: 'Игрок 3', avatar: null },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [spyCount, setSpyCount] = useState(1);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [familyFriendly, setFamilyFriendly] = useState(true);
  const [questionSource, setQuestionSource] = useState<QuestionSource>('library');
  const [roundLimit, setRoundLimit] = useState(true);
  const [showQuestionToSpy, setShowQuestionToSpy] = useState(true);
  const [anonymousVoting, setAnonymousVoting] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerToUpdateAvatar = useRef<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  useEffect(() => {
    try {
      const savedSettingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (savedSettingsRaw) {
        const saved = JSON.parse(savedSettingsRaw);
        if (saved.players && Array.isArray(saved.players) && saved.players.length > 0) {
          setPlayers(saved.players);
        }
        if (typeof saved.spyCount === 'number') setSpyCount(saved.spyCount);
        if (typeof saved.votingEnabled === 'boolean') setVotingEnabled(saved.votingEnabled);
        if (typeof saved.familyFriendly === 'boolean') setFamilyFriendly(saved.familyFriendly);
        if (saved.questionSource) setQuestionSource(saved.questionSource);
        if (typeof saved.roundLimit === 'boolean') setRoundLimit(saved.roundLimit);
        if (typeof saved.showQuestionToSpy === 'boolean') setShowQuestionToSpy(saved.showQuestionToSpy);
        if (typeof saved.anonymousVoting === 'boolean') setAnonymousVoting(saved.anonymousVoting);
      }
    } catch (e) { console.error("Failed to load local game settings", e); }
  }, []);
  useEffect(() => {
    try {
      const settingsToSave = { players, spyCount, votingEnabled, familyFriendly, questionSource, roundLimit, showQuestionToSpy, anonymousVoting };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (e) { console.error("Failed to save local game settings", e); }
  }, [players, spyCount, votingEnabled, familyFriendly, questionSource, roundLimit, showQuestionToSpy, anonymousVoting]);
  const playerCount = players.length;
  const maxSpyCount = useMemo(() => Math.max(1, Math.min(3, Math.floor((playerCount - 1) / 2))), [playerCount]);
  useEffect(() => { if (spyCount > maxSpyCount) setSpyCount(maxSpyCount); }, [maxSpyCount, spyCount]);
  const handleAddPlayer = () => {
    const trimmedName = newPlayerName.trim();
    if (trimmedName && !players.some(p => p.name === trimmedName)) {
      setPlayers([...players, { id: generateId(), name: trimmedName, avatar: null }]);
      setNewPlayerName('');
    }
  };
  const handleRemovePlayer = useCallback((idToRemove: string) => {
    setPlayers(p => p.filter(player => player.id !== idToRemove));
  }, []);
  const handleEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditingName(players[index].name);
  }, [players]);
  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const trimmedName = editingName.trim();
    const existingPlayer = players.find(p => p.name === trimmedName);
    if (trimmedName && (!existingPlayer || existingPlayer.id === players[editingIndex].id)) {
      setPlayers(currentPlayers => {
        const newPlayers = [...currentPlayers];
        newPlayers[editingIndex].name = trimmedName;
        return newPlayers;
      });
    }
    setEditingIndex(null);
    setEditingName('');
  }, [editingIndex, editingName, players]);
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && playerToUpdateAvatar.current) {
      try {
        const file = e.target.files[0];
        const processedAvatar = await processImage(file);
        setPlayers(currentPlayers => currentPlayers.map(p => 
          p.id === playerToUpdateAvatar.current ? { ...p, avatar: processedAvatar } : p
        ));
      } catch (err) { console.error("Error processing image:", err); }
      finally {
        playerToUpdateAvatar.current = null;
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };
  const triggerAvatarUpload = useCallback((playerId: string) => {
    playerToUpdateAvatar.current = playerId;
    fileInputRef.current?.click();
  }, []);
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => { dragItem.current = position; };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => { dragOverItem.current = position; };
  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newPlayers = [...players];
    const dragItemContent = newPlayers[dragItem.current];
    newPlayers.splice(dragItem.current, 1);
    newPlayers.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setPlayers(newPlayers);
  };
  const handleGameStartClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (players.length >= 3) {
      onGameStart(players, spyCount, votingEnabled, questionSource, familyFriendly, roundLimit, showQuestionToSpy, anonymousVoting);
    }
  };
  const handleAiSourceClick = () => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
        setQuestionSource('ai');
    } else {
        setIsApiModalOpen(true);
    }
  };
  const handleApiModalSave = () => {
      setIsApiModalOpen(false);
      setQuestionSource('ai');
  };
  const handleApiModalCancel = () => {
      setIsApiModalOpen(false);
      if (!localStorage.getItem('gemini-api-key')) {
          setQuestionSource('library');
      }
  };
  return (
    <div className="flex flex-col items-center text-center animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6">Настройки игры (Локально)</h2>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      <ApiKeyModal isOpen={isApiModalOpen} onSave={handleApiModalSave} onCancel={handleApiModalCancel} />
      <div className="flex flex-col md:flex-row gap-8 w-full">
        <form onSubmit={handleGameStartClick} className="w-full md:w-1/2 space-y-6">
          <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Количество шпионов: <span className="font-bold text-white">{spyCount}</span></label>
              <input type="range" min="1" max={maxSpyCount} value={spyCount} onChange={(e) => setSpyCount(parseInt(e.target.value, 10))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
          </div>
           <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Источник вопросов</label>
              <div className="flex justify-center bg-slate-700 rounded-lg p-1 items-center gap-1">
                <button type="button" onClick={() => setQuestionSource('library')} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${questionSource === 'library' ? 'bg-cyan-500 text-slate-900' : 'text-slate-300 hover:bg-slate-600'}`}>Библиотека</button>
                <div className="relative w-1/2">
                    <button
                        type="button"
                        onClick={handleAiSourceClick}
                        className={`w-full py-2 rounded-md font-semibold transition-colors ${questionSource === 'ai' ? 'bg-cyan-500 text-slate-900' : 'text-slate-300 hover:bg-slate-600'}`}
                    >
                        ИИ Генерация
                    </button>
                    {questionSource === 'ai' && (
                        <button
                            type="button"
                            onClick={() => setIsApiModalOpen(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-cyan-700/50 hover:bg-cyan-600"
                            aria-label="Изменить API ключ"
                        >
                            <PencilIcon className="h-4 w-4 text-white" />
                        </button>
                    )}
                </div>
              </div>
          </div>
          <div>
              <label htmlFor="votingEnabledToggle" className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                  <span>Режим голосования</span>
                  <div className="relative inline-flex items-center">
                  <input type="checkbox" id="votingEnabledToggle" checked={votingEnabled} onChange={() => setVotingEnabled(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
              </label>
          </div>
          <div>
              <label htmlFor="familyFriendlyToggle" className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                  <span>Семейный режим</span>
                  <div className="relative inline-flex items-center">
                  <input type="checkbox" id="familyFriendlyToggle" checked={familyFriendly} onChange={() => setFamilyFriendly(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
              </label>
          </div>
           <div>
              <label htmlFor="roundLimitToggle" className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                  <span>Ограничение по раундам</span>
                  <div className="relative inline-flex items-center">
                  <input type="checkbox" id="roundLimitToggle" checked={roundLimit} onChange={() => setRoundLimit(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
              </label>
          </div>
           <div>
              <label htmlFor="showQuestionToSpyToggle" className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                  <span className="flex items-center gap-1 text-left">
                      Показывать вопрос шпиону
                  </span>
                  <div className="relative inline-flex items-center">
                  <input type="checkbox" id="showQuestionToSpyToggle" checked={showQuestionToSpy} onChange={() => setShowQuestionToSpy(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
              </label>
          </div>
          <div>
              <label htmlFor="anonymousVotingToggle" className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                  <span>Анонимное голосование</span>
                  <div className="relative inline-flex items-center">
                  <input type="checkbox" id="anonymousVotingToggle" checked={anonymousVoting} onChange={() => setAnonymousVoting(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                  </div>
              </label>
          </div>
          <button type="submit" disabled={playerCount < 3} className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none">
            Начать игру
          </button>
          {playerCount < 3 && <p className="text-sm text-yellow-400">Нужно как минимум 3 игрока для начала.</p>}
        </form>
        <div className="w-full md:w-1/2">
            <h3 className="text-xl font-semibold mb-4 text-white">Игроки ({players.length}):</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto bg-slate-900/50 p-3 rounded-lg mb-4">
                {players.map((p, index) => (
                    <PlayerListItem 
                        key={p.id}
                        player={p}
                        index={index}
                        editingIndex={editingIndex}
                        editingName={editingName}
                        onEdit={handleEdit}
                        onSaveEdit={handleSaveEdit}
                        setEditingName={setEditingName}
                        onRemove={handleRemovePlayer}
                        onAvatarClick={triggerAvatarUpload}
                        onDragStart={handleDragStart}
                        onDragEnter={handleDragEnter}
                        onDragEnd={handleDrop}
                        onDragOver={(e: any) => e.preventDefault()}
                    />
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (handleAddPlayer(), e.preventDefault())}
                    className="w-full bg-slate-700 text-white p-2 rounded-lg border-2 border-slate-600 focus:border-cyan-500 focus:outline-none" placeholder="Имя нового игрока" maxLength={15}
                />
                <button onClick={handleAddPlayer} className="bg-green-600 hover:bg-green-500 text-white font-bold p-2 rounded-lg transition-colors">Добавить</button>
            </div>
        </div>
      </div>
    </div>
  );
};