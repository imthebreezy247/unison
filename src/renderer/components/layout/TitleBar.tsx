import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    window.unisonx?.system?.minimize();
  };

  const handleClose = () => {
    window.unisonx?.system?.close();
  };

  const handleQuit = () => {
    window.unisonx?.system?.quit();
  };

  return (
    <div className="title-bar flex items-center justify-between h-8 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
      </div>
      
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        UnisonX - iPhone Integration
      </div>
      
      <div className="flex items-center space-x-1">
        <button
          onClick={handleMinimize}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleQuit}
          className="p-1 hover:bg-red-500 hover:text-white rounded text-gray-600 dark:text-gray-400"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};