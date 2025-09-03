import React from 'react';
import { Subtitle } from '../types';
import SubtitleItem from './SubtitleItem';
import { EyeIcon, EyeOffIcon, ClockIcon, NoClockIcon, FilterIcon, LineLengthIcon } from './icons/Icons';

interface SubtitleEditorProps {
  subtitles: Subtitle[];
  showOriginal: boolean;
  setShowOriginal: (show: boolean) => void;
  showTimecodes: boolean;
  setShowTimecodes: (show: boolean) => void;
  hasTotalLengthErrors: boolean;
  showErrorsOnly: boolean;
  setShowErrorsOnly: (show: boolean) => void;
  hasLongLines: boolean;
  showLongLinesOnly: boolean;
  setShowLongLinesOnly: (show: boolean) => void;
  onUpdateSubtitle: (id: number, newText: string) => void;
  onUndoSubtitle: (id: number) => void;
  onSplitSubtitle: (id: number) => void;
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = (props) => {
  const { 
    subtitles, 
    showOriginal, 
    setShowOriginal, 
    showTimecodes, 
    setShowTimecodes, 
    hasTotalLengthErrors,
    showErrorsOnly,
    setShowErrorsOnly,
    hasLongLines,
    showLongLinesOnly,
    setShowLongLinesOnly,
    ...itemProps 
  } = props;
  
  const hasOriginalText = subtitles.some(sub => sub.originalText);

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
      <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Subtitle Entries</h3>
        <div className="flex items-center space-x-4">
          {hasTotalLengthErrors && (
             <button
              onClick={() => setShowErrorsOnly(!showErrorsOnly)}
              className={`flex items-center text-sm transition-colors ${showErrorsOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showErrorsOnly ? 'Show All' : 'Show entries with total length > 74 chars'}
            >
              <FilterIcon className="h-5 w-5 mr-1" />
              <span>Total Length</span>
            </button>
          )}
          {hasLongLines && (
             <button
              onClick={() => setShowLongLinesOnly(!showLongLinesOnly)}
              className={`flex items-center text-sm transition-colors ${showLongLinesOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showLongLinesOnly ? 'Show All' : 'Show entries with a line > 37 chars'}
            >
              <LineLengthIcon className="h-5 w-5 mr-1" />
              <span>Line Length</span>
            </button>
          )}
          {hasOriginalText && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="flex items-center text-sm text-gray-300 hover:text-white transition-colors"
              title={showOriginal ? 'Hide Original Text' : 'Show Original Text'}
            >
              {showOriginal ? <EyeOffIcon className="h-5 w-5 mr-1" /> : <EyeIcon className="h-5 w-5 mr-1" />}
              <span>Original</span>
            </button>
          )}
          <button
            onClick={() => setShowTimecodes(!showTimecodes)}
            className="flex items-center text-sm text-gray-300 hover:text-white transition-colors"
            title={showTimecodes ? 'Hide Timecodes' : 'Show Timecodes'}
          >
            {showTimecodes ? <NoClockIcon className="h-5 w-5 mr-1" /> : <ClockIcon className="h-5 w-5 mr-1" />}
            <span>Timecodes</span>
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="divide-y divide-gray-700">
          {subtitles.map((subtitle) => (
            <SubtitleItem
              key={subtitle.id}
              subtitle={subtitle}
              showOriginal={showOriginal}
              showTimecodes={showTimecodes}
              {...itemProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubtitleEditor;