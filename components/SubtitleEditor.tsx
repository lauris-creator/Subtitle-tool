import React from 'react';
import { Subtitle } from '../types';
import { CascadePlan } from '../utils/timecodeUtils';
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
  hasTooShortSegments: boolean;
  showTooShortOnly: boolean;
  setShowTooShortOnly: (show: boolean) => void;
  hasTooLongSegments: boolean;
  showTooLongOnly: boolean;
  setShowTooLongOnly: (show: boolean) => void;
  hasTimecodeConflicts: boolean;
  showTimecodeConflictsOnly: boolean;
  setShowTimecodeConflictsOnly: (show: boolean) => void;
  hasMultiLineInFiltered: boolean;
  onRemoveBreaksFromFiltered: () => void;
  hasLongLinesInFiltered: boolean;
  onSplitFilteredLines: () => void;
  hasSplittableInFiltered: boolean;
  onBulkSplitFiltered: () => void;
  hasTimecodeConflictsInFiltered: boolean;
  onFixTimecodeConflicts: () => void;
  onCascadePreview: () => void;
  onApplyCascadeFix: () => void;
  cascadePreview: CascadePlan | null;
  showCascadePreview: boolean;
  onCloseCascadePreview: () => void;
  onShowAll: () => void;
  onUpdateSubtitle: (id: number, newText: string) => void;
  onUpdateTimecode: (id: number, newStartTime: string, newEndTime: string) => void;
  onUndoSubtitle: (id: number) => void;
  onSplitSubtitle: (id: number) => void;
  onMergeNext: (id: number) => void;
  maxTotalChars: number;
  maxLineChars: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
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
    hasTooShortSegments,
    showTooShortOnly,
    setShowTooShortOnly,
    hasTooLongSegments,
    showTooLongOnly,
    setShowTooLongOnly,
    hasTimecodeConflicts,
    showTimecodeConflictsOnly,
    setShowTimecodeConflictsOnly,
    hasMultiLineInFiltered,
    onRemoveBreaksFromFiltered,
    hasLongLinesInFiltered,
    onSplitFilteredLines,
    hasSplittableInFiltered,
    onBulkSplitFiltered,
    hasTimecodeConflictsInFiltered,
    onFixTimecodeConflicts,
    onCascadePreview,
    onApplyCascadeFix,
    cascadePreview,
    showCascadePreview,
    onCloseCascadePreview,
    onMergeNext,
    onShowAll,
    maxTotalChars,
    maxLineChars,
    minDurationSeconds,
    maxDurationSeconds,
    ...itemProps 
  } = props;
  
  const hasOriginalText = subtitles.some(sub => sub.originalText);

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
      <div className="p-4 bg-gray-800/50 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Subtitle Entries</h3>
        <div className="flex items-center space-x-4">
          <button
            onClick={onShowAll}
            className="flex items-center text-sm transition-colors text-gray-300 hover:text-white"
            title="Show all subtitles (clear all filters)"
          >
            <span className="mr-1">👁️</span>
            <span>Show All</span>
          </button>
          {hasTotalLengthErrors && (
             <button
              onClick={() => setShowErrorsOnly(!showErrorsOnly)}
              className={`flex items-center text-sm transition-colors ${showErrorsOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showErrorsOnly ? 'Show All' : `Show entries with total length > ${maxTotalChars} chars`}
            >
              <FilterIcon className="h-5 w-5 mr-1" />
              <span>Total Length</span>
            </button>
          )}
          {hasLongLines && (
             <button
              onClick={() => setShowLongLinesOnly(!showLongLinesOnly)}
              className={`flex items-center text-sm transition-colors ${showLongLinesOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showLongLinesOnly ? 'Show All' : `Show entries with a line > ${maxLineChars} chars`}
            >
              <LineLengthIcon className="h-5 w-5 mr-1" />
              <span>Line Length</span>
            </button>
          )}
          {hasTooShortSegments && (
             <button
              onClick={() => setShowTooShortOnly(!showTooShortOnly)}
              className={`flex items-center text-sm transition-colors ${showTooShortOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showTooShortOnly ? 'Show All' : `Show entries under ${minDurationSeconds} second${minDurationSeconds !== 1 ? 's' : ''}`}
            >
              <ClockIcon className="h-5 w-5 mr-1" />
              <span>Too Short</span>
            </button>
          )}
          {hasTooLongSegments && (
             <button
              onClick={() => setShowTooLongOnly(!showTooLongOnly)}
              className={`flex items-center text-sm transition-colors ${showTooLongOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showTooLongOnly ? 'Show All' : `Show entries over ${maxDurationSeconds} second${maxDurationSeconds !== 1 ? 's' : ''}`}
            >
              <ClockIcon className="h-5 w-5 mr-1" />
              <span>Too Long</span>
            </button>
          )}
          {hasTimecodeConflicts && (
             <button
              onClick={() => setShowTimecodeConflictsOnly(!showTimecodeConflictsOnly)}
              className={`flex items-center text-sm transition-colors ${showTimecodeConflictsOnly ? 'text-sky-400' : 'text-gray-300 hover:text-white'}`}
              title={showTimecodeConflictsOnly ? 'Show All' : 'Show entries with overlapping timecodes'}
            >
              <ClockIcon className="h-5 w-5 mr-1" />
              <span>Time Conflicts</span>
            </button>
          )}
          {hasMultiLineInFiltered && (
             <button
              onClick={onRemoveBreaksFromFiltered}
              className="flex items-center text-sm transition-colors text-gray-300 hover:text-white"
              title="Remove line breaks from all visible subtitles (convert to single line)"
            >
              <span className="mr-1">📝</span>
              <span>Remove Breaks</span>
            </button>
          )}
          {hasLongLinesInFiltered && (
             <button
              onClick={onSplitFilteredLines}
              className="flex items-center text-sm transition-colors text-gray-300 hover:text-white"
              title="Split long lines in all visible subtitles"
            >
              <span className="mr-1">¶</span>
              <span>Paragraph Lines</span>
            </button>
          )}
          {hasSplittableInFiltered && (
             <button
              onClick={onBulkSplitFiltered}
              className="flex items-center text-sm transition-colors text-orange-400 hover:text-orange-300"
              title="Split all visible subtitles into two parts with proportional timecodes"
            >
              <span className="mr-1">✂️</span>
              <span>Bulk Split Filtered</span>
            </button>
          )}
          {hasTimecodeConflictsInFiltered && (
             <button
              onClick={onFixTimecodeConflicts}
              className="flex items-center text-sm transition-colors text-red-400 hover:text-red-300"
              title="Fix timecode conflicts by reducing end times by 1ms"
            >
              <span className="mr-1">🔧</span>
              <span>Fix Conflicts</span>
            </button>
          )}
          {hasTimecodeConflictsInFiltered && (
             <button
              onClick={onCascadePreview}
              className="flex items-center text-sm transition-colors text-orange-400 hover:text-orange-300"
              title="Smart cascade fix - intelligently adjust multiple segments"
            >
              <span className="mr-1">🧠</span>
              <span>Smart Fix</span>
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
              maxTotalChars={maxTotalChars}
              maxLineChars={maxLineChars}
              minDurationSeconds={minDurationSeconds}
              maxDurationSeconds={maxDurationSeconds}
              onMergeNext={onMergeNext}
              {...itemProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubtitleEditor;