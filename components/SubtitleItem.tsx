import React from 'react';
import { Subtitle } from '../types';
import { WarningIcon, UndoIcon, SplitIcon, ClockIcon } from './icons/Icons';
import { calculateDuration, formatDuration } from '../utils/timeUtils';
import { validateSplit } from '../utils/textUtils';

interface SubtitleItemProps {
  subtitle: Subtitle;
  showOriginal: boolean;
  showTimecodes: boolean;
  onUpdateSubtitle: (id: number, newText: string) => void;
  onUndoSubtitle: (id: number) => void;
  onSplitSubtitle: (id: number) => void;
  maxTotalChars: number;
  maxLineChars: number;
}

const SubtitleItem: React.FC<SubtitleItemProps> = ({
  subtitle,
  showOriginal,
  showTimecodes,
  onUpdateSubtitle,
  onUndoSubtitle,
  onSplitSubtitle,
  maxTotalChars,
  maxLineChars,
}) => {
  const hasLongLine = subtitle.text.split('\n').some(line => line.length > maxLineChars);
  
  // Calculate duration for this subtitle
  const duration = calculateDuration(subtitle.startTime, subtitle.endTime);
  const canSplit = validateSplit(subtitle.text);
  const translatedLines = subtitle.text.split('\n');
  const lineCounts = translatedLines.map(line => line.length);

  return (
    <div className={`p-4 transition-colors ${
      subtitle.recentlyEdited ? 'bg-green-900/20 border-l-4 border-green-500' : 
      subtitle.isLong ? 'bg-red-900/20' : 'hover:bg-gray-700/50'
    }`}>
      <div className="flex flex-col md:flex-row gap-4">
        {showTimecodes && (
          <div className="md:w-1/6 text-sm text-gray-400 font-mono flex-shrink-0">
            <p>{subtitle.startTime}</p>
            <p>{subtitle.endTime}</p>
            <div className="mt-2 space-y-1">
              <p className="text-xs">ID: {subtitle.id}</p>
              <div className="flex items-center gap-1 text-blue-400">
                <ClockIcon className="h-3 w-3" />
                <span className="text-xs">{formatDuration(duration)}</span>
              </div>
              {canSplit && (
                <button
                  onClick={() => onSplitSubtitle(subtitle.id)}
                  className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  title="Split this subtitle into two parts"
                >
                  <SplitIcon className="h-3 w-3" />
                  Split
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
          {showOriginal && subtitle.originalText && (
            <div className="pr-4 border-r-0 md:border-r md:border-gray-600">
              <label className="text-xs font-bold text-gray-500 uppercase">Original</label>
              <p className="text-gray-300 whitespace-pre-wrap">{subtitle.originalText}</p>
            </div>
          )}
          
          <div className={!showOriginal || !subtitle.originalText ? 'md:col-span-2' : ''}>
            <div className="flex justify-between items-start">
               <div className="flex items-center">
                <label className="text-xs font-bold text-gray-500 uppercase">Translated</label>
                {subtitle.recentlyEdited && (
                  <span className="text-green-400 text-xs bg-green-900/50 px-2 py-1 rounded ml-2">
                    ✓ Recently edited
                  </span>
                )}
                {subtitle.canUndo && (
                  <button
                    onClick={() => onUndoSubtitle(subtitle.id)}
                    className="ml-2 p-1 text-xs rounded text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                    title="Undo changes to this subtitle"
                  >
                    <UndoIcon className="h-4 w-4" />
                  </button>
                )}
                {hasLongLine && (
                  <WarningIcon className="h-4 w-4 ml-2 text-red-400" title={`A line exceeds ${maxLineChars} characters.`} />
                )}
                {subtitle.isTooShort && (
                  <WarningIcon className="h-4 w-4 ml-2 text-orange-400" title="Segment is under 1 second." />
                )}
                {subtitle.isTooLong && (
                  <WarningIcon className="h-4 w-4 ml-2 text-purple-400" title="Segment is over 7 seconds." />
                )}
              </div>
              <span className={`text-sm font-semibold ${subtitle.isLong ? 'text-red-400' : 'text-green-400'}`}>
                {subtitle.charCount} chars
              </span>
            </div>
            <div className="relative w-full mt-1">
                <div 
                    aria-hidden="true" 
                    className="absolute left-2 top-2 h-full flex flex-col font-mono text-sm text-gray-500 select-none pointer-events-none"
                >
                    {lineCounts.map((count, index) => (
                        <span 
                            key={index} 
                            className={`leading-6 ${count > maxLineChars ? 'text-red-400 font-bold' : ''}`}
                        >
                            {count}
                        </span>
                    ))}
                </div>
                <textarea
                    value={subtitle.text}
                    onChange={(e) => onUpdateSubtitle(subtitle.id, e.target.value)}
                    className={`w-full bg-gray-900/50 text-white p-2 rounded-md border resize-none whitespace-pre-wrap pl-10 text-sm leading-6 ${subtitle.isLong || hasLongLine ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-sky-500 focus:border-sky-500'}`}
                    rows={translatedLines.length || 1}
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubtitleItem;