import React, { useState, useRef, useEffect } from 'react';
import { Player, ChatMessage } from '../types';
import { ChatIcon, CheckIcon, ReadIcon } from './icons';
import { Avatar } from './Avatar';

interface ChatProps {
    localPlayer: Player;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onChatOpen: () => void;
    isEliminated: boolean;
}

const MessageStatus: React.FC<{ status?: 'sending' | 'sent' | 'read' }> = ({ status }) => {
    if (status === 'sending') {
        return <CheckIcon className="w-4 h-4 text-slate-400" title="Отправка..." />;
    }
    if (status === 'sent') {
        return <CheckIcon className="w-4 h-4 text-cyan-400" title="Доставлено" />;
    }
    if (status === 'read') {
        return <ReadIcon className="w-4 h-4 text-cyan-400" title="Прочитано" />;
    }
    return null;
};

export const Chat: React.FC<ChatProps> = ({ localPlayer, messages, onSendMessage, onChatOpen, isEliminated }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastReadMessageCount = useRef(messages.length);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            onChatOpen();
            // When chat is opened, mark all current messages as "read" and reset the counter.
            lastReadMessageCount.current = messages.length;
            setUnreadCount(0);
            scrollToBottom();
        } else {
            // When chat is closed, calculate unread messages based on the last time it was open.
            const newMessages = messages.slice(lastReadMessageCount.current);
            const newUnreadFromOthers = newMessages.filter(m => m.senderId !== localPlayer.id).length;
            setUnreadCount(newUnreadFromOthers);
        }
    }, [messages, isOpen, localPlayer.id, onChatOpen]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);


    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        if (trimmedMessage) {
            onSendMessage(trimmedMessage);
            setNewMessage('');
        }
    };
    
    const toggleChat = () => {
        setIsOpen(prev => !prev);
    };

    return (
        <div className="fixed bottom-4 left-4 z-30">
            {isOpen ? (
                <div className="w-80 h-96 bg-slate-800/90 backdrop-blur-sm rounded-xl shadow-lg flex flex-col animate-fade-in">
                    <div className="flex justify-between items-center p-3 border-b border-slate-700">
                        <h3 className="font-bold text-white">Чат</h3>
                        <button onClick={toggleChat} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto">
                        {messages.map((msg) => (
                            <div key={`${msg.timestamp}-${msg.senderId}`} className={`flex items-start gap-2 mb-3 ${msg.senderId === localPlayer.id ? 'justify-end' : ''}`}>
                                {msg.senderId !== localPlayer.id && <Avatar avatar={msg.senderAvatar} className="w-8 h-8 mt-1 flex-shrink-0" />}
                                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${msg.senderId === localPlayer.id ? 'bg-cyan-600' : 'bg-slate-600'}`}>
                                    {msg.senderId !== localPlayer.id && <p className="text-xs font-bold text-cyan-300">{msg.senderName}</p>}
                                    <div className="flex items-end gap-2">
                                        <p className="text-sm text-white break-words whitespace-pre-wrap">{msg.text}</p>
                                        {msg.senderId === localPlayer.id && <div className="self-end flex-shrink-0"><MessageStatus status={msg.status} /></div>}
                                    </div>
                                </div>
                                {msg.senderId === localPlayer.id && <Avatar avatar={localPlayer.avatar} className="w-8 h-8 mt-1 flex-shrink-0" />}
                            </div>
                        ))}
                         <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSend} className="p-3 border-t border-slate-700 flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className={`w-full p-2 rounded-lg border-2 focus:outline-none text-sm ${isEliminated ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' : 'bg-slate-700 text-white border-slate-600 focus:border-cyan-500'}`}
                            placeholder={isEliminated ? "Вы выбыли и не можете писать" : "Написать сообщение..."}
                            maxLength={100}
                            disabled={isEliminated}
                        />
                        <button type="submit" disabled={isEliminated} className={`font-bold p-2 rounded-lg transition-colors ${isEliminated ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900'}`}>Отпр.</button>
                    </form>
                </div>
            ) : (
                <button
                    onClick={toggleChat}
                    className="relative w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-400 transition-all duration-200 transform hover:scale-110"
                    aria-label="Открыть чат"
                >
                    <ChatIcon className="w-8 h-8 text-slate-900" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-slate-900">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
};