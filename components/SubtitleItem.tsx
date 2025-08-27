import React from 'react';
import { Subtitle } from '../types';
import { MAX_LINE_CHARS, MAX_TOTAL_CHARS } from '../constants';
import { CheckIcon, SparklesIcon, XIcon, WarningIcon, RefreshIcon, UndoIcon } from './icons/Icons';

interface SubtitleItemProps {
  subtitle: Subtitle;
  showOriginal: boolean;
  showTimecodes: boolean;
  onSuggestion: (id: number) => void;
  onUpdateSubtitle: (id: number, newText: string) => void;
  onUpdateSuggestion: (id: number, newSuggestion: string) => void;
  onAcceptSuggestion: (id: number) => void;
  onUndoSubtitle: (id: number) => void;
}

const splitText = (text: string): [string, string] => {
  const words = text.split(' ');
  let line1 = '';
  let line2 = '';
  
  for (const word of words) {
    if ((line1 + ' ' + word).trim().length <= MAX_LINE_CHARS) {
      line1 = (line1 + ' ' + word).trim();
    } else {
      line2 = (line2 + ' ' + word).trim();
    }
  }

  if (line2.length > MAX_LINE_CHARS) {
      // simple split if second line is also too long
      const splitPoint = Math.ceil(text.length / 2);
      const potentialBreak = text.lastIndexOf(' ', splitPoint);
      const breakPoint = potentialBreak === -1 ? splitPoint : potentialBreak;
      return [text.substring(0, breakPoint).trim(), text.substring(breakPoint).trim()];
  }
  
  return [line1, line2];
};

const SubtitleItem: React.FC<SubtitleItemProps> = ({
  subtitle,
  showOriginal,
  showTimecodes,
  onSuggestion,
  onUpdateSubtitle,
  onUpdateSuggestion,
  onAcceptSuggestion,
  onUndoSubtitle,
}) => {
  const [splitSuggestionLine1, splitSuggestionLine2] = subtitle.suggestion ? splitText(subtitle.suggestion) : ['', ''];
  const suggestionCharCount = subtitle.suggestion?.replace(/\n/g, '').length ?? 0;
  const isSuggestionLong = suggestionCharCount > MAX_TOTAL_CHARS;

  const hasLongLine = subtitle.text.split('\n').some(line => line.length > MAX_LINE_CHARS);
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
            <p className="mt-2 text-xs">ID: {subtitle.id}</p>
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
                  <WarningIcon className="h-4 w-4 ml-2 text-red-400" title={`A line exceeds ${MAX_LINE_CHARS} characters.`} />
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
                            className={`leading-6 ${count > MAX_LINE_CHARS ? 'text-red-400 font-bold' : ''}`}
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

        {subtitle.isLong && (
          <div className="md:w-1/3 flex-shrink-0">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <h4 className="text-sm font-bold text-amber-400 flex items-center mb-2">
                <WarningIcon className="h-5 w-5 mr-2" />
                Line too long
              </h4>
              {subtitle.suggestionLoading && (
                 <div className="flex items-center justify-center text-gray-400">
                    <RefreshIcon className="h-5 w-5 mr-2 animate-spin"/> Generating...
                 </div>
              )}
              {!subtitle.suggestionLoading && !subtitle.suggestion && (
                <button 
                  onClick={() => onSuggestion(subtitle.id)} 
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <SparklesIcon className="h-5 w-5 mr-2"/>
                  Generate Suggestion
                </button>
              )}
              {subtitle.suggestion && (
                 <div>
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-gray-500 uppercase">AI Suggestion</label>
                      <span className={`text-sm font-semibold ${isSuggestionLong ? 'text-red-400' : 'text-gray-400'}`}>
                        {suggestionCharCount} / {MAX_TOTAL_CHARS}
                      </span>
                    </div>
                    <textarea
                      value={subtitle.suggestion}
                      onChange={(e) => onUpdateSuggestion(subtitle.id, e.target.value)}
                      className={`w-full bg-gray-800 text-white p-2 rounded-md border mt-1 resize-none ${isSuggestionLong ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'}`}
                      rows={2}
                    />
                    <div className="mt-2 text-xs text-gray-400">
                        <p className="font-bold">Split Preview:</p>
                        <p className="font-mono p-1 bg-gray-900 rounded">{splitSuggestionLine1}</p>
                        <p className="font-mono p-1 bg-gray-900 rounded mt-1">{splitSuggestionLine2}</p>
                    </div>
                    <div className="flex items-center space-x-2 mt-3">
                        <button 
                          onClick={() => onAcceptSuggestion(subtitle.id)}
                          disabled={isSuggestionLong}
                          className="flex-grow flex items-center justify-center p-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors" title="Accept Suggestion">
                           <CheckIcon className="h-5 w-5 mr-1"/> Accept
                        </button>
                        <button 
                          onClick={() => onSuggestion(subtitle.id)}
                          className="p-2 text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-500" title="Regenerate">
                            <RefreshIcon className="h-5 w-5"/>
                        </button>
                    </div>
                 </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubtitleItem;