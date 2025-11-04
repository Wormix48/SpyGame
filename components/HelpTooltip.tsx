import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { QuestionMarkIcon } from './icons';
const RulesContent: React.FC = () => (
    <div className="space-y-4 text-slate-300 text-left text-sm">
        <div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Цель игры</h3>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Игроки:</strong> Вычислить и проголосовать против всех шпионов.</li>
                <li><strong>Шпионы:</strong> Скрывать свою роль, блефовать и не быть раскрытыми до конца игры.</li>
            </ul>
        </div>
        <div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Ход игры</h3>
            <ol className="list-decimal list-inside space-y-1">
                <li><strong>Роли:</strong> В начале игры каждому анонимно присваивается роль: "Игрок" или "Шпион".</li>
                <li><strong>Вопрос:</strong> В каждом раунде задается вопрос с вариантами ответа. Шпионы не видят вопрос.</li>
                <li><strong>Ответ:</strong> Все игроки выбирают один из вариантов. Шпиону приходится выбирать наугад.</li>
                <li><strong>Обсуждение и Голосование:</strong> Ответы всех игроков показываются на экране. Игроки обсуждают и голосуют за исключение подозреваемого.</li>
                <li><strong>Раскрытие:</strong> Роль игрока, набравшего большинство голосов, раскрывается.</li>
                <li><strong>Новый раунд:</strong> Если игра не окончена, начинается новый раунд.</li>
            </ol>
        </div>
        <div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Условия победы</h3>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Победа игроков:</strong> Все шпионы найдены.</li>
                <li><strong>Победа шпионов:</strong> Шпионов становится столько же, сколько игроков или шпион остаётся нераскрытым за отведённое число раундов.</li>
            </ul>
        </div>
        <div>
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Параметры игры</h3>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Источник вопросов:</strong> "Библиотека" (готовые) или "ИИ Генерация" (требует API ключ <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://aistudio.google.com/api-keys</a>).</li>
                 <li><strong>Семейный режим:</strong> Исключает провокационные вопросы.</li>
                <li><strong>Ограничение по раундам:</strong> Если вкл, игра закончится через N-1 раундов (где N - число игроков).</li>
                 <li><strong>Без таймера (Онлайн):</strong> Отключает таймеры. Хост решает, когда закончить этап.</li>
                <li><strong>Показывать вопрос шпиону:</strong> Если вкл, шпион увидит вопрос после своего ответа. Если выкл, шпион играет вслепую до конца раунда (сильное усложнение).</li>
            </ul>
        </div>
    </div>
);
const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return createPortal(
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
        >
            <div
                className="bg-slate-800 rounded-lg shadow-xl p-6 m-4 w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 id="rules-title" className="text-2xl font-bold text-white">Правила игры</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none" aria-label="Закрыть">&times;</button>
                </div>
                <div className="overflow-y-auto pr-2">
                    <RulesContent />
                </div>
            </div>
        </div>,
        document.body
    );
};
export const HelpTooltip: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative z-20">
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-600 transition-colors"
                aria-label="Правила игры"
            >
                <QuestionMarkIcon className="w-6 h-6 text-white" />
            </button>
            {isOpen && <RulesModal onClose={() => setIsOpen(false)} />}
        </div>
    );
};