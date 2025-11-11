import React from 'react';
import { PlayerIcon } from './icons';
interface AvatarProps {
  avatar: string | null;
  className?: string;
}
export const Avatar: React.FC<AvatarProps> = ({ avatar, className }) => {
  // Render as emoji if it's not a base64 image (or null)
  if (avatar) {
    const fontSize = className?.includes('w-32') ? 'text-6xl' : 
                     className?.includes('w-24') ? 'text-5xl' : 
                     className?.includes('w-10') ? 'text-2xl' : 
                     className?.includes('w-8') ? 'text-xl' : 'text-lg';
    return (
      <div className={`flex items-center justify-center bg-slate-700 rounded-full ${className}`}>
        <span className={fontSize}>{avatar}</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-slate-700 rounded-full ${className}`}>
      <PlayerIcon className="w-3/4 h-3/4 text-slate-400" />
    </div>
  );
};