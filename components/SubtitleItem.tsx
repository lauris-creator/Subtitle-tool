import React, { useState, useEffect } from 'react';
import { Subtitle } from '../types';
import { WarningIcon, UndoIcon, SplitIcon, ClockIcon } from './icons/Icons';
import { calculateDuration, formatDuration } from '../utils/timeUtils';
import { validateSplit } from '../utils/textUtils';
import { parseTimecodeInput } from '../utils/timecodeUtils';

interface SubtitleItemProps {
  subtitle: Subtitle;
  fileSpecificId?: number;
  showOriginal: boolean;
  showTimecodes: boolean;
  onUpdateSubtitle: (id: number, newText: string) => void;
  onUpdateTimecode: (id: number, newStartTime: string, newEndTime: string) => void;
  onUndoSubtitle: (id: number) => void;
  onSplitSubtitle: (id: number) => void;
  onMergeNext: (id: number) => void;
  onDeleteSegment: (id: number) => void;
  maxTotalChars: number;
  maxLineChars: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

const SubtitleItem: React.FC<SubtitleItemProps> = React.memo(({
  subtitle,
  fileSpecificId,
  showOriginal,
  showTimecodes,
  onUpdateSubtitle,
  onUpdateTimecode,
  onUndoSubtitle,
  onSplitSubtitle,
  onMergeNext,
  onDeleteSegment,
  maxTotalChars,
  maxLineChars,
  minDurationSeconds,
  maxDurationSeconds,
}) => {
  const hasLongLine = subtitle.text.split('\n').some(line => line.length > maxLineChars);
  const [isEditingTimecode, setIsEditingTimecode] = useState(false);
  const [editStartTime, setEditStartTime] = useState(subtitle.startTime);
  const [editEndTime, setEditEndTime] = useState(subtitle.endTime);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Calculate duration for this subtitle
  const duration = calculateDuration(subtitle.startTime, subtitle.endTime);

  // Update edit state when subtitle changes (e.g., after save)
  useEffect(() => {
    if (!isEditingTimecode) {
      setEditStartTime(subtitle.startTime);
      setEditEndTime(subtitle.endTime);
    }
  }, [subtitle.startTime, subtitle.endTime, isEditingTimecode]);

  const handleTimecodeSave = () => {
    const formattedStartTime = parseTimecodeInput(editStartTime);
    const formattedEndTime = parseTimecodeInput(editEndTime);

    onUpdateTimecode(subtitle.id, formattedStartTime, formattedEndTime);
    setIsEditingTimecode(false);

    // Show brief confirmation
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 2000);
  };

  const handleTimecodeCancel = () => {
    setEditStartTime(subtitle.startTime);
    setEditEndTime(subtitle.endTime);
    setIsEditingTimecode(false);
  };
  const canSplit = validateSplit(subtitle.text);
  const translatedLines = subtitle.text.split('\n');
  const lineCounts = translatedLines.map(line => line.length);
  const isEmpty = subtitle.text.trim().length === 0 || subtitle.charCount === 0;

  return (
    <div className={`p-4 transition-colors ${subtitle.recentlyEdited ? 'bg-green-900/20 border-l-4 border-green-500' :
      subtitle.isLong ? 'bg-red-900/20' : 'hover:bg-gray-700/50'
      }`}
      style={{ contentVisibility: 'auto' }}
    >
      <div className="flex flex-col md:flex-row gap-4">
        {showTimecodes && (
          <div className="md:w-1/6 text-sm text-gray-400 font-mono flex-shrink-0">
            {isEditingTimecode ? (
              <div className="space-y-2">
                <div>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="00:00:00,000"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="00:00:00,000"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleTimecodeSave}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleTimecodeCancel}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
                  >
                    ✗
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => setIsEditingTimecode(true)}
                  title="Click to edit timecode"
                >
                  {subtitle.startTime}
                </p>
                <p
                  className="cursor-pointer hover:text-white transition-colors"
                  onClick={() => setIsEditingTimecode(true)}
                  title="Click to edit timecode"
                >
                  {subtitle.endTime}
                </p>
              </div>
            )}
            <div className="mt-2 space-y-1">
              <p className="text-xs">ID: {fileSpecificId || subtitle.id}</p>
              {subtitle.sourceFile && (
                <p className="text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded">
                  📁 {subtitle.sourceFile}
                </p>
              )}
              <div className="flex items-center gap-1 text-blue-400">
                <ClockIcon className="h-3 w-3" />
                <span className="text-xs">{formatDuration(duration)}</span>
              </div>
              {showSaveConfirmation && (
                <div className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                  ✓ Saved
                </div>
              )}
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
              <button
                onClick={() => onMergeNext(subtitle.id)}
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                title="Merge this subtitle with the next one"
              >
                <span className="h-3 w-3">➕</span>
                Merge Next
              </button>
              {isEmpty && (
                <button
                  onClick={() => onDeleteSegment(subtitle.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                  title="Delete this empty segment"
                >
                  <span className="h-3 w-3">🗑️</span>
                  Delete
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
                  <WarningIcon className="h-4 w-4 ml-2 text-orange-400" title={`Segment is under ${minDurationSeconds} second${minDurationSeconds !== 1 ? 's' : ''}.`} />
                )}
                {subtitle.isTooLong && (
                  <WarningIcon className="h-4 w-4 ml-2 text-purple-400" title={`Segment is over ${maxDurationSeconds} second${maxDurationSeconds !== 1 ? 's' : ''}.`} />
                )}
                {subtitle.hasTimecodeConflict && (
                  <WarningIcon className="h-4 w-4 ml-2 text-yellow-400" title="Timecode overlaps with another segment." />
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
}, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these properties change
  return (
    prevProps.subtitle.id === nextProps.subtitle.id &&
    prevProps.subtitle.text === nextProps.subtitle.text &&
    prevProps.subtitle.startTime === nextProps.subtitle.startTime &&
    prevProps.subtitle.endTime === nextProps.subtitle.endTime &&
    prevProps.subtitle.charCount === nextProps.subtitle.charCount &&
    prevProps.subtitle.isLong === nextProps.subtitle.isLong &&
    prevProps.subtitle.isTooShort === nextProps.subtitle.isTooShort &&
    prevProps.subtitle.isTooLong === nextProps.subtitle.isTooLong &&
    prevProps.subtitle.hasTimecodeConflict === nextProps.subtitle.hasTimecodeConflict &&
    prevProps.subtitle.recentlyEdited === nextProps.subtitle.recentlyEdited &&
    prevProps.subtitle.canUndo === nextProps.subtitle.canUndo &&
    prevProps.showOriginal === nextProps.showOriginal &&
    prevProps.showTimecodes === nextProps.showTimecodes &&
    prevProps.maxTotalChars === nextProps.maxTotalChars &&
    prevProps.maxLineChars === nextProps.maxLineChars &&
    prevProps.minDurationSeconds === nextProps.minDurationSeconds &&
    prevProps.maxDurationSeconds === nextProps.maxDurationSeconds
  );
});

export default SubtitleItem;