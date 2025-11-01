import React from 'react';

interface LoadingScreenProps {
  title?: string;
  description?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
    title = "Загрузка...", 
    description 
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[450px]">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-500 mb-6"></div>
      <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
      {description && <p className="text-slate-300">{description}</p>}
    </div>
  );
};
