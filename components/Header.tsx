import React from 'react';
import { DownloadIcon, ScissorsIcon, UndoIcon } from './icons/Icons';
import Logo from './Logo';

interface HeaderProps {
  onDownload: () => void;
  hasTranslatedSubs: boolean;
  onSplitAll: () => void;
  hasLongLines: boolean;
  onUndo: () => void;
  canUndo: boolean;
}

const Header: React.FC<HeaderProps> = ({ onDownload, hasTranslatedSubs, onSplitAll, hasLongLines, onUndo, canUndo }) => {
  return (
    <header className="bg-gray-800 shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Logo size="small" />
          </div>
          <div className="flex items-center space-x-4">
            {canUndo && (
              <button
                onClick={onUndo}
                className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                title="Undo the last action"
              >
                <UndoIcon className="h-5 w-5 mr-2" />
                Undo
              </button>
            )}
            {hasTranslatedSubs && hasLongLines && (
              <button
                onClick={onSplitAll}
                className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                title="Automatically split all lines that are longer than 37 characters"
              >
                <ScissorsIcon className="h-5 w-5 mr-2" />
                Split Long Lines
              </button>
            )}
            {hasTranslatedSubs && (
              <button
                onClick={onDownload}
                className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
              >
                <DownloadIcon className="h-5 w-5 mr-2" />
                Download Edited SRT
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;