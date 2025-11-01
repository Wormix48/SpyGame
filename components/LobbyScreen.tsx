import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import { processImage } from '../utils';
import { PencilIcon } from './icons';


interface LobbyScreenProps {
  onCreateRoom: (playerName: string, avatar: string | null) => void;
  onJoinRoom: (playerName: string, roomId: string, avatar: string | null) => void;
  initialRoomId: string | null;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onCreateRoom, onJoinRoom, initialRoomId }) => {
  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [roomId, setRoomId] = useState(initialRoomId?.toUpperCase() ?? '');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
        const savedProfile = localStorage.getItem('spy-game-player-profile');
        if (savedProfile) {
            const { name, avatar } = JSON.parse(savedProfile);
            if (name) setPlayerName(name);
            if (avatar) setAvatar(avatar);
        }
    } catch (e) {
        console.error("Failed to parse player profile from localStorage", e);
    }
  }, []);

  const saveProfile = () => {
      try {
          const profile = JSON.stringify({ name: playerName.trim(), avatar });
          localStorage.setItem('spy-game-player-profile', profile);
      } catch (e) {
          console.error("Failed to save player profile to localStorage", e);
      }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const processedAvatar = await processImage(file);
        setAvatar(processedAvatar);
      } catch (err) {
        console.error("Error processing image:", err);
        setError("Не удалось обработать изображение. Попробуйте другое.");
      }
    }
  };

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('Пожалуйста, введите ваше имя.');
      return;
    }
    setError('');
    saveProfile();
    onCreateRoom(playerName.trim(), avatar);
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomId.trim()) {
      setError('Пожалуйста, введите имя и код комнаты.');
      return;
    }
    setError('');
    saveProfile();
    onJoinRoom(playerName.trim(), roomId.trim().toUpperCase(), avatar);
  };

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <h2 className="text-3xl font-bold text-white mb-6">Добро пожаловать!</h2>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <Avatar avatar={avatar} className="w-32 h-32" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Сменить аватар"
            >
              <PencilIcon className="w-8 h-8" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-slate-700 text-white text-center text-xl p-2 rounded-lg border-2 border-slate-600 focus:border-cyan-500 focus:outline-none"
            placeholder="Введите имя"
            maxLength={15}
          />
        </div>
        
        <button
          onClick={handleCreate}
          className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-3 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
        >
          Создать комнату
        </button>

        <div className="flex items-center w-full">
            <hr className="w-full border-slate-600" />
            <span className="px-4 text-slate-400 font-semibold">ИЛИ</span>
            <hr className="w-full border-slate-600" />
        </div>

        <div className="space-y-4">
            <label htmlFor="roomId" className="block text-lg font-medium text-slate-300">Присоединиться к комнате</label>
             <input
                id="roomId"
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-slate-700 text-white text-center text-xl p-2 rounded-lg border-2 border-slate-600 focus:border-cyan-500 focus:outline-none tracking-widest"
                placeholder="КОД КОМНАТЫ"
                maxLength={6}
            />
            <button
                onClick={handleJoin}
                className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg text-xl transition-all duration-200 transform hover:scale-105"
            >
                Присоединиться
            </button>
        </div>
         {error && <p className="text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
};