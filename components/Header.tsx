import React from 'react';
import { DownloadIcon, ScissorsIcon, UndoIcon, TrashIcon } from './icons/Icons';
import Logo from './Logo';

interface HeaderProps {
  onDownload: () => void;
  hasTranslatedSubs: boolean;
  onUndo: () => void;
  canUndo: boolean;
  onClearSession: () => void;
  maxTotalChars: number;
  maxLineChars: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  // Multi-file support
  availableFiles: string[];
  currentFileFilter: string | null;
  onFileFilterChange: (fileName: string | null) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  onDownload, 
  hasTranslatedSubs, 
  onUndo, 
  canUndo, 
  onClearSession,
  maxTotalChars,
  maxLineChars,
  minDurationSeconds,
  maxDurationSeconds,
  availableFiles,
  currentFileFilter,
  onFileFilterChange
}) => {
  return (
    <header className="bg-gray-800 shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Logo size="small" />
          </div>
          <div className="flex items-center space-x-4">
            {hasTranslatedSubs && (
              <button
                onClick={onClearSession}
                className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                title="Clear all data and start fresh"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Clear
              </button>
            )}
            {hasTranslatedSubs && (
              <div className="relative group">
                <button
                  className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  title="Current validation settings"
                >
                  <span className="text-xs">⚙️</span>
                </button>
                
                {/* Hover Tooltip */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-3 text-center">Current Validation Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700 rounded p-3">
                        <h4 className="text-xs font-semibold text-gray-200 mb-2 flex items-center">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5"></span>
                          Characters
                        </h4>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-300">Total:</span>
                            <span className="text-xs font-semibold text-blue-400">{maxTotalChars}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-300">Per Line:</span>
                            <span className="text-xs font-semibold text-blue-400">{maxLineChars}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-700 rounded p-3">
                        <h4 className="text-xs font-semibold text-gray-200 mb-2 flex items-center">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></span>
                          Duration
                        </h4>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-300">Min:</span>
                            <span className="text-xs font-semibold text-green-400">{minDurationSeconds}s</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-300">Max:</span>
                            <span className="text-xs font-semibold text-green-400">{maxDurationSeconds}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-xs text-gray-500">
                        💡 Change settings on upload page
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
            {hasTranslatedSubs && availableFiles.length > 1 && (
              <div className="relative">
                <select
                  value={currentFileFilter || 'all'}
                  onChange={(e) => onFileFilterChange(e.target.value === 'all' ? null : e.target.value)}
                  className="appearance-none bg-gray-700 border border-gray-600 text-white px-3 py-2 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  title="Filter by file"
                >
                  <option value="all">All Files ({availableFiles.length})</option>
                  {availableFiles.map((fileName, index) => (
                    <option key={index} value={fileName}>
                      {fileName}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
            {hasTranslatedSubs && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onDownload}
                  className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                  title="Download current document"
                >
                  <DownloadIcon className="h-5 w-5 mr-2" />
                  Download Current
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;