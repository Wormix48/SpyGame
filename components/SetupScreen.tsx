import React, { useState, useMemo, useEffect } from 'react';
import { QuestionSource, Player } from '../types';
import { Avatar } from './Avatar';
import { CrossIcon, PencilIcon, KeyIcon, WarningIcon } from './icons';
import { ApiKeyModal } from './ApiKeyModal';

interface SetupScreenProps {
  onGameStart: (spyCount: number, questionSource: QuestionSource, familyFriendly: boolean) => void;
  players: Player[];
  isHost: boolean;
  roomId: string;
  initialSettings: {
    initialSpyCount: number;
    questionSource: QuestionSource;
    familyFriendly: boolean;
    noTimer: boolean;
    roundLimit: boolean;
    showQuestionToSpy: boolean;
    anonymousVoting: boolean;
  };
  onSettingsChange: (settings: { spyCount?: number, questionSource?: QuestionSource, familyFriendly?: boolean, noTimer?: boolean, roundLimit?: boolean, showQuestionToSpy?: boolean, anonymousVoting?: boolean }) => void;
  onKickPlayer: (playerId: string) => void;
  onTransferHost: (playerId: string) => void;
}

const SETTINGS_KEY = 'spy-game-online-settings';

export const SetupScreen: React.FC<SetupScreenProps> = ({ onGameStart, players, isHost, roomId, initialSettings, onSettingsChange, onKickPlayer, onTransferHost }) => {
  const [copyButtonText, setCopyButtonText] = useState('Копировать ссылку-приглашение');
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  
  // Load settings on initial mount for host, then let parent component control state
  useEffect(() => {
    if (!isHost) return;
    try {
      const savedSettingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (savedSettingsRaw) {
        const saved = JSON.parse(savedSettingsRaw);
        // We only apply these settings once on load, subsequent changes come from parent state
        onSettingsChange({
          spyCount: saved.spyCount ?? initialSettings.initialSpyCount,
          familyFriendly: saved.familyFriendly ?? initialSettings.familyFriendly,
          questionSource: saved.questionSource ?? initialSettings.questionSource,
          noTimer: saved.noTimer ?? initialSettings.noTimer,
          roundLimit: saved.roundLimit ?? initialSettings.roundLimit,
          showQuestionToSpy: saved.showQuestionToSpy ?? initialSettings.showQuestionToSpy,
          anonymousVoting: saved.anonymousVoting ?? initialSettings.anonymousVoting,
        });
      }
    } catch (e) {
      console.error("Failed to load online game settings", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  // Save settings whenever they change for host
  useEffect(() => {
    if (!isHost) return;
    try {
      const { initialSpyCount, ...restOfSettings } = initialSettings;
      const settingsToSave = { spyCount: initialSpyCount, ...restOfSettings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch(e) {
      console.error("Failed to save online game settings", e);
    }
  }, [isHost, initialSettings]);
  
  const playerCount = players.length;

  const maxSpyCount = useMemo(() => {
    const maxBasedOnBalance = Math.floor((playerCount - 1) / 2);
    return Math.max(1, Math.min(3, maxBasedOnBalance));
  }, [playerCount]);
  
  useEffect(() => {
    if (isHost && initialSettings.initialSpyCount > maxSpyCount) {
      onSettingsChange({ spyCount: maxSpyCount });
    }
  }, [isHost, maxSpyCount, initialSettings.initialSpyCount, onSettingsChange]);

  const handleCopyLink = () => {
    const plainUrl = window.location.href.split('?')[0];
    const invitationLink = `${plainUrl}?join=${roomId}`;
    navigator.clipboard.writeText(invitationLink).then(() => {
        setCopyButtonText('Ссылка скопирована!');
        setTimeout(() => setCopyButtonText('Копировать ссылку-приглашение'), 2000);
    }, () => {
        setCopyButtonText('Ошибка копирования');
        setTimeout(() => setCopyButtonText('Копировать ссылку-приглашение'), 2000);
    });
  };

  const handleGameStartClick = (e: React.FormEvent) => {
    e.preventDefault();
    onGameStart(initialSettings.initialSpyCount, initialSettings.questionSource, initialSettings.familyFriendly);
  };

  const handleAiSourceClick = () => {
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
        onSettingsChange({ questionSource: 'ai' });
    } else {
        setIsApiModalOpen(true);
    }
  };

  const handleApiModalSave = () => {
      setIsApiModalOpen(false);
      onSettingsChange({ questionSource: 'ai' });
  };

  const handleApiModalCancel = () => {
      setIsApiModalOpen(false);
      if (!localStorage.getItem('gemini-api-key')) {
          onSettingsChange({ questionSource: 'library' });
      }
  };
  
  if (!isHost) {
      return (
          <div className="flex flex-col items-center justify-center text-center min-h-[450px]">
              <h2 className="text-3xl font-bold text-white mb-6">Комната: {roomId}</h2>
              <p className="text-slate-300 mb-8">Ожидание начала игры от хоста...</p>
               <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="w-full">
                    <h3 className="text-xl font-semibold mb-4 text-white">Игроки ({players.length}):</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto bg-slate-900/50 p-3 rounded-lg">
                        {players.map(p => (
                            <div key={p.id} className="flex items-center justify-center gap-3 bg-slate-700 p-2 rounded-lg text-lg font-medium text-white">
                                <Avatar avatar={p.avatar} className="w-8 h-8" />
                                <span>{p.name} {p.isHost && '👑'}</span>
                                {p.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился" />}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-full bg-slate-900/50 p-4 rounded-lg">
                    <h3 className="text-xl font-semibold mb-4 text-white">Настройки игры:</h3>
                    <div className="space-y-2 text-left text-slate-300">
                        <div className="flex justify-between"><span>Шпионы:</span> <span className="font-bold text-white">{initialSettings.initialSpyCount}</span></div>
                        <div className="flex justify-between"><span>Вопросы:</span> <span className="font-bold text-white">{initialSettings.questionSource === 'ai' ? 'ИИ' : 'Библиотека'}</span></div>
                        <div className="flex justify-between"><span>Семейный режим:</span> <span className="font-bold text-white">{initialSettings.familyFriendly ? 'Вкл' : 'Выкл'}</span></div>
                        <div className="flex justify-between"><span>Без таймера:</span> <span className="font-bold text-white">{initialSettings.noTimer ? 'Вкл' : 'Выкл'}</span></div>
                        <div className="flex justify-between"><span>Лимит раундов:</span> <span className="font-bold text-white">{initialSettings.roundLimit ? 'Вкл' : 'Выкл'}</span></div>
                        <div className="flex justify-between"><span>Показ вопроса шпиону:</span> <span className="font-bold text-white">{initialSettings.showQuestionToSpy ? 'Вкл' : 'Выкл'}</span></div>
                        <div className="flex justify-between"><span>Анонимное голосование:</span> <span className="font-bold text-white">{initialSettings.anonymousVoting ? 'Вкл' : 'Выкл'}</span></div>
                    </div>
                </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-3xl font-bold text-white mb-4">Настройки игры</h2>
      <ApiKeyModal isOpen={isApiModalOpen} onSave={handleApiModalSave} onCancel={handleApiModalCancel} />
      <div className="w-full max-w-md bg-slate-900/50 p-4 rounded-xl mb-6 text-center">
        <p className="text-lg font-medium text-slate-300 mb-2">Пригласите друзей в комнату</p>
        <div className="flex items-center justify-center bg-slate-700 rounded-lg p-2 gap-4">
            <span className="text-2xl font-bold text-cyan-400 tracking-widest select-all">{roomId}</span>
            <button 
              onClick={handleCopyLink}
              className="flex-grow bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
            >
              {copyButtonText}
            </button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-8 w-full">
        <form onSubmit={handleGameStartClick} className="w-full md:w-1/2 space-y-8">
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Количество шпионов: <span className="font-bold text-white">{initialSettings.initialSpyCount}</span></label>
              <input
                type="range" min="1" max={maxSpyCount} value={initialSettings.initialSpyCount}
                onChange={(e) => onSettingsChange({ spyCount: parseInt(e.target.value, 10) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div>
              <label className="block text-lg font-medium text-slate-300 mb-2">Источник вопросов</label>
              <div className="flex justify-center bg-slate-700 rounded-lg p-1 items-center gap-1">
                  <button type="button" onClick={() => onSettingsChange({ questionSource: 'library' })} className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${initialSettings.questionSource === 'library' ? 'bg-cyan-500 text-slate-900' : 'text-slate-300 hover:bg-slate-600'}`}>
                      Библиотека
                  </button>
                  <div className="relative w-1/2">
                      <button type="button" onClick={handleAiSourceClick} className={`w-full py-2 rounded-md font-semibold transition-colors ${initialSettings.questionSource === 'ai' ? 'bg-cyan-500 text-slate-900' : 'text-slate-300 hover:bg-slate-600'}`}>
                          ИИ Генерация
                      </button>
                      {initialSettings.questionSource === 'ai' && (
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
                <label className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                    <span>Семейный режим</span>
                    <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={initialSettings.familyFriendly} onChange={() => onSettingsChange({ familyFriendly: !initialSettings.familyFriendly })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
            <div>
                <label className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                    <span>Без таймера</span>
                    <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={initialSettings.noTimer} onChange={() => onSettingsChange({ noTimer: !initialSettings.noTimer })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
             <div>
                <label className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                    <span>Ограничение по раундам</span>
                    <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={initialSettings.roundLimit} onChange={() => onSettingsChange({ roundLimit: !initialSettings.roundLimit })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
             <div>
                <label className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                    <span>Показывать вопрос шпиону</span>
                    <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={initialSettings.showQuestionToSpy} onChange={() => onSettingsChange({ showQuestionToSpy: !initialSettings.showQuestionToSpy })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
            <div>
                <label className="flex items-center justify-between text-lg font-medium text-slate-300 cursor-pointer">
                    <span>Анонимное голосование</span>
                    <div className="relative inline-flex items-center">
                    <input type="checkbox" checked={initialSettings.anonymousVoting} onChange={() => onSettingsChange({ anonymousVoting: !initialSettings.anonymousVoting })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                    </div>
                </label>
            </div>
            <button 
              type="submit" 
              disabled={playerCount < 3}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl transition-transform transform hover:scale-105 disabled:bg-slate-600 disabled:cursor-not-allowed disabled:transform-none"
            >
              Начать игру
            </button>
            {playerCount < 3 && <p className="text-sm text-yellow-400">Нужно как минимум 3 игрока для начала.</p>}
        </form>
        <div className="w-full md:w-1/2">
            <h3 className="text-xl font-semibold mb-4 text-white">Игроки ({players.length}):</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto bg-slate-900/50 p-3 rounded-lg">
                {players.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-slate-700 p-2 rounded-lg text-lg font-medium text-white">
                        <div className="flex items-center gap-3 truncate">
                            <Avatar avatar={p.avatar} className="w-8 h-8 flex-shrink-0" />
                            <span className="truncate flex items-center gap-2">
                                {p.name} {p.isHost && '👑'}
                                {p.connectionStatus === 'disconnected' && <WarningIcon className="w-4 h-4 text-yellow-400" title="Игрок отключился"/>}
                            </span>
                        </div>
                        {isHost && !p.isHost && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => onTransferHost(p.id)}
                                    className="text-yellow-400 hover:text-yellow-300 p-1 rounded-full hover:bg-slate-600 transition-colors"
                                    aria-label={`Передать хоста ${p.name}`}
                                    title="Передать хоста"
                                >
                                    <KeyIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => onKickPlayer(p.id)}
                                    className="text-red-500 hover:text-red-400 p-1 rounded-full hover:bg-slate-600 transition-colors"
                                    aria-label={`Исключить ${p.name}`}
                                    title="Исключить"
                                >
                                    <CrossIcon className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};