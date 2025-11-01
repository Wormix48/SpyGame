

import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: () => void;
  onCancel: () => void;
}

const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey.trim()) return false;
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Use a small, fast model for a quick and inexpensive validation call.
        await ai.models.generateContent({
            model: 'gemini-flash-latest', 
            contents: 'test'
        });
        return true;
    } catch (error) {
        console.error("API Key validation failed:", error);
        return false;
    }
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onCancel }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('gemini-api-key');
      if (savedKey) {
        setApiKey(savedKey);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsValidating(true);
    setError('');
    const isValid = await validateApiKey(apiKey);
    if (isValid) {
        localStorage.setItem('gemini-api-key', apiKey);
        onSave();
    } else {
        setError('Неверный API ключ или нет доступа к API. Попробуйте другой ключ.');
    }
    setIsValidating(false);
  };
  
  const handleCancel = () => {
      setError('');
      setApiKey('');
      onCancel();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" aria-modal="true" role="dialog">
      <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
        <h2 id="modal-title" className="text-2xl font-bold text-white mb-4">Введите Gemini API ключ</h2>
        <p className="text-slate-400 mb-4">
            Для генерации вопросов с помощью ИИ требуется ваш собственный API ключ от Google AI Studio. 
            Ключ будет сохранен в вашем браузере для будущих игр.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full bg-slate-700 text-white p-2 rounded-lg border-2 border-slate-600 focus:border-cyan-500 focus:outline-none"
          placeholder="AIza..."
          disabled={isValidating}
          aria-labelledby="modal-title"
        />
        {error && <p className="text-red-400 mt-2 text-sm" role="alert">{error}</p>}
        {isValidating && <p className="text-cyan-400 mt-2 text-sm" aria-live="polite">Проверка ключа...</p>}

        <div className="flex justify-end gap-4 mt-6">
          <button onClick={handleCancel} disabled={isValidating} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} disabled={isValidating || !apiKey.trim()} className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold py-2 px-4 rounded-lg disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors">
            {isValidating ? 'Проверка...' : 'Сохранить и использовать'}
          </button>
        </div>
      </div>
    </div>
  );
};