import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Subtitle } from './types';
import { parseSrt, formatSrt } from './services/srtParser';
import { sessionManager } from './services/sessionManager';
import { splitTextIntelligently, splitLineIntelligently } from './utils/textUtils';
import { splitTimeProportionally, calculateDuration } from './utils/timeUtils';
import { hasTimecodeConflict, parseTimecodeInput, reduceTimecodeByOneMs, calculateCascadePlan, applyCascadeFix, CascadePlan } from './utils/timecodeUtils';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import SubtitleEditor from './components/SubtitleEditor';
import Logo from './components/Logo';
import { MAX_LINE_CHARS, MAX_TOTAL_CHARS } from './constants';

const App: React.FC = () => {
  const [originalSubtitles, setOriginalSubtitles] = useState<Subtitle[]>([]);
  const [translatedSubtitles, setTranslatedSubtitles] = useState<Subtitle[]>([]);
  const [previousSubtitles, setPreviousSubtitles] = useState<Subtitle[] | null>(null); // For undo
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [showTimecodes, setShowTimecodes] = useState<boolean>(true);
  const [showErrorsOnly, setShowErrorsOnly] = useState<boolean>(false);
  const [showLongLinesOnly, setShowLongLinesOnly] = useState<boolean>(false);
  const [showTooShortOnly, setShowTooShortOnly] = useState<boolean>(false);
  const [showTooLongOnly, setShowTooLongOnly] = useState<boolean>(false);
  const [showTimecodeConflictsOnly, setShowTimecodeConflictsOnly] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [sessionRestored, setSessionRestored] = useState<boolean>(false);
  const [maxTotalChars, setMaxTotalChars] = useState<number>(MAX_TOTAL_CHARS);
  const [maxLineChars, setMaxLineChars] = useState<number>(MAX_LINE_CHARS);
  const [minDurationSeconds, setMinDurationSeconds] = useState<number>(1);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>(7);
  const [cascadePreview, setCascadePreview] = useState<CascadePlan | null>(null);
  const [showCascadePreview, setShowCascadePreview] = useState<boolean>(false);

  // Restore session on component mount
  useEffect(() => {
    const savedSession = sessionManager.loadSession();
    if (savedSession) {
      setOriginalSubtitles(savedSession.originalSubtitles);
      setTranslatedSubtitles(savedSession.translatedSubtitles);
      setFileName(savedSession.fileName);
      setSessionRestored(true);
      
      const sessionAge = sessionManager.getSessionAge();
      console.log(`📂 Session restored! Last saved ${sessionAge} minutes ago.`);
    }
  }, []);

  // Auto-save session when subtitles change
  useEffect(() => {
    if (sessionRestored || translatedSubtitles.length > 0) {
      sessionManager.saveSession({
        originalSubtitles,
        translatedSubtitles,
        fileName,
        maxTotalChars,
        maxLineChars,
        minDurationSeconds,
        maxDurationSeconds
      });
    }
  }, [originalSubtitles, translatedSubtitles, fileName, sessionRestored, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  // Clear "recently edited" status when filters change (not after timeout)
  useEffect(() => {
    // Clear recently edited when user changes filters
    setTranslatedSubtitles(prev => prev.map(sub => ({
      ...sub,
      recentlyEdited: false,
      editedAt: undefined
    })));
  }, [showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly]); // Clear when filters change

  const handleFileUpload = (content: string, type: 'original' | 'translated', name: string) => {
    const subs = parseSrt(content);
    setPreviousSubtitles(null); // Clear undo history on new file upload
    if (type === 'translated') {
      // Apply current character limits and duration validation to parsed subtitles
      const processedSubs = subs.map(sub => {
        const charCount = sub.text.replace(/\n/g, '').length;
        const isLong = charCount > maxTotalChars;
        const duration = calculateDuration(sub.startTime, sub.endTime);
        const isTooShort = duration < minDurationSeconds;
        const isTooLong = duration > maxDurationSeconds;
        const hasConflict = hasTimecodeConflict(sub, subs);
        return {
          ...sub,
          charCount,
          isLong,
          duration,
          isTooShort,
          isTooLong,
          hasTimecodeConflict: hasConflict
        };
      });
      setTranslatedSubtitles(processedSubs);
      setFileName(name);
      // If original is already loaded, merge them
      if (originalSubtitles.length > 0) {
        setTranslatedSubtitles(prevSubs => prevSubs.map((sub, index) => ({
          ...sub,
          originalText: originalSubtitles[index]?.text || '',
        })));
      }
    } else {
      setOriginalSubtitles(subs);
      // If translated is already loaded, merge them
      if (translatedSubtitles.length > 0) {
        setTranslatedSubtitles(prevSubs => prevSubs.map((sub, index) => ({
          ...sub,
          originalText: subs[index]?.text || '',
        })));
      }
    }
  };

  // Recalculate subtitle validation when limits change
  useEffect(() => {
    if (translatedSubtitles.length > 0) {
      setTranslatedSubtitles(prev => prev.map(sub => {
        const charCount = sub.text.replace(/\n/g, '').length;
        const isLong = charCount > maxTotalChars;
        const duration = calculateDuration(sub.startTime, sub.endTime);
        const isTooShort = duration < minDurationSeconds;
        const isTooLong = duration > maxDurationSeconds;
        const hasConflict = hasTimecodeConflict(sub, prev);
        return {
          ...sub,
          charCount,
          isLong,
          duration,
          isTooShort,
          isTooLong,
          hasTimecodeConflict: hasConflict
        };
      }));
    }
  }, [maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds, translatedSubtitles.length]);

  const handleUpdateTimecode = useCallback((id: number, newStartTime: string, newEndTime: string) => {
    setTranslatedSubtitles(prev => {
      const now = Date.now();
      return prev.map(sub => {
        if (sub.id === id) {
          const updatedSub = {
            ...sub,
            startTime: newStartTime,
            endTime: newEndTime,
            duration: calculateDuration(newStartTime, newEndTime),
            isTooShort: calculateDuration(newStartTime, newEndTime) < minDurationSeconds,
            isTooLong: calculateDuration(newStartTime, newEndTime) > maxDurationSeconds,
            previousStartTime: sub.startTime,
            previousEndTime: sub.endTime,
            recentlyEdited: true,
            editedAt: now,
            canUndo: true
          };
          
          // Check for conflicts with updated timecodes
          const hasConflict = hasTimecodeConflict(updatedSub, prev.map(s => 
            s.id === id ? updatedSub : s
          ));
          
          return {
            ...updatedSub,
            hasTimecodeConflict: hasConflict
          };
        }
        return sub;
      });
    });
  }, [minDurationSeconds, maxDurationSeconds]);

  const handleUpdateSubtitle = useCallback((id: number, newText: string) => {
    setTranslatedSubtitles(prev => {
        const line = newText.replace(/<br\s*\/?>/gi, '\n');
        const charCount = line.replace(/\n/g, '').length;
        const isLong = charCount > maxTotalChars;
        const now = Date.now();
        return prev.map(sub => sub.id === id ? { 
          ...sub, 
          previousText: sub.text, // Store previous text for undo
          text: line, 
          charCount, 
          isLong,
          duration: calculateDuration(sub.startTime, sub.endTime),
          isTooShort: calculateDuration(sub.startTime, sub.endTime) < minDurationSeconds,
          isTooLong: calculateDuration(sub.startTime, sub.endTime) > maxDurationSeconds,
          recentlyEdited: true,
          editedAt: now,
          canUndo: true
        } : sub)
    });
    setPreviousSubtitles(null); // Manual edit clears global undo
  }, [maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleMergeSubtitleWithNext = useCallback((id: number) => {
    setTranslatedSubtitles(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1 || index === prev.length - 1) return prev; // nothing to merge

      const current = prev[index];
      const next = prev[index + 1];

      const mergedText = `${current.text} ${next.text}`.replace(/\s+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
      const mergedStart = current.startTime;
      const mergedEnd = next.endTime;

      const charCount = mergedText.replace(/\n/g, '').length;
      const duration = calculateDuration(mergedStart, mergedEnd);

      const merged: Subtitle = {
        ...current,
        text: mergedText,
        startTime: mergedStart,
        endTime: mergedEnd,
        charCount,
        isLong: charCount > maxTotalChars,
        duration,
        isTooShort: duration < minDurationSeconds,
        isTooLong: duration > maxDurationSeconds,
        recentlyEdited: true,
        editedAt: Date.now(),
        canUndo: false,
        previousText: undefined
      };

      // Build new subtitles: replace current with merged, remove next
      const newSubtitles = [
        ...prev.slice(0, index),
        merged,
        ...prev.slice(index + 2)
      ].map((sub, i) => ({ ...sub, id: i + 1 }));

      // Recompute conflicts
      const recomputed = newSubtitles.map(s => ({
        ...s,
        hasTimecodeConflict: hasTimecodeConflict(s, newSubtitles)
      }));

      return recomputed;
    });

    // Merge originals if present
    setOriginalSubtitles(prev => {
      if (!prev || prev.length === 0) return prev;
      const index = prev.findIndex(s => s.id === id);
      if (index === -1 || index === prev.length - 1) return prev;

      const current = prev[index];
      const next = prev[index + 1];

      const mergedText = `${current.text} ${next.text}`.replace(/\s+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();
      const mergedStart = current.startTime;
      const mergedEnd = next.endTime;

      const charCount = mergedText.replace(/\n/g, '').length;
      const duration = calculateDuration(mergedStart, mergedEnd);

      const merged: Subtitle = {
        ...current,
        text: mergedText,
        startTime: mergedStart,
        endTime: mergedEnd,
        charCount,
        isLong: charCount > maxTotalChars,
        duration,
        isTooShort: duration < minDurationSeconds,
        isTooLong: duration > maxDurationSeconds,
        recentlyEdited: true,
        editedAt: Date.now()
      };

      const newSubtitles = [
        ...prev.slice(0, index),
        merged,
        ...prev.slice(index + 2)
      ].map((sub, i) => ({ ...sub, id: i + 1 }));

      return newSubtitles;
    });

    // Structure changed, clear global undo
    setPreviousSubtitles(null);
  }, [maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleDownload = () => {
    if (translatedSubtitles.length === 0) return;
    const srtContent = formatSrt(translatedSubtitles);
    // Add UTF-8 BOM for better compatibility with subtitle players
    const contentWithBOM = '\uFEFF' + srtContent;
    const blob = new Blob([contentWithBOM], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited_${fileName || 'subtitles.srt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSplitFilteredLines = useCallback(() => {
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      return prev.map(sub => {
        // Only process subtitles that are currently visible in filtered view
        const isInFilteredView = currentFilteredSubtitles.some(filteredSub => filteredSub.id === sub.id);
        
        if (isInFilteredView) {
          const lines = sub.text.split('\n');
          const needsSplitting = lines.some(line => line.length > maxLineChars);

          if (!needsSplitting) {
            return sub;
          }

          const newLines = lines.flatMap(line => splitLineIntelligently(line, maxLineChars));

          const newText = newLines.join('\n');
          const newCharCount = newText.replace(/\n/g, '').length;
          const duration = calculateDuration(sub.startTime, sub.endTime);
          const isTooShort = duration < minDurationSeconds;
          const isTooLong = duration > maxDurationSeconds;
          const hasConflict = hasTimecodeConflict({...sub, text: newText}, prev.map(s => 
            s.id === sub.id ? {...sub, text: newText} : s
          ));
          
          return {
            ...sub,
            text: newText,
            charCount: newCharCount,
            isLong: newCharCount > maxTotalChars,
            duration,
            isTooShort,
            isTooLong,
            hasTimecodeConflict: hasConflict,
            recentlyEdited: true,
            editedAt: Date.now(),
            canUndo: true,
            previousText: sub.text
          };
        }
        return sub;
      });
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleUndo = () => {
    if (previousSubtitles) {
      setTranslatedSubtitles(previousSubtitles);
      setPreviousSubtitles(null);
    }
  };

  const handleClearSession = () => {
    if (confirm('Are you sure you want to start fresh? This will clear all current work.')) {
      sessionManager.clearSession();
      setOriginalSubtitles([]);
      setTranslatedSubtitles([]);
      setPreviousSubtitles(null);
      setFileName('');
      setSessionRestored(false);
      console.log('🗑️ Session cleared. Starting fresh!');
    }
  };

  const handleShowAll = () => {
    setShowErrorsOnly(false);
    setShowLongLinesOnly(false);
    setShowTooShortOnly(false);
    setShowTooLongOnly(false);
    setShowTimecodeConflictsOnly(false);
  };

  const handleRemoveBreaksFromFiltered = useCallback(() => {
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      return prev.map(sub => {
        // Only process subtitles that are currently visible in filtered view
        const isInFilteredView = currentFilteredSubtitles.some(filteredSub => filteredSub.id === sub.id);
        
        if (isInFilteredView && sub.text.includes('\n')) {
          const singleLineText = sub.text.replace(/\n/g, ' ');
          const charCount = singleLineText.length;
          const isLong = charCount > maxTotalChars;
          const duration = calculateDuration(sub.startTime, sub.endTime);
          const isTooShort = duration < minDurationSeconds;
          const isTooLong = duration > maxDurationSeconds;
          const hasConflict = hasTimecodeConflict({...sub, text: singleLineText}, prev.map(s => 
            s.id === sub.id ? {...sub, text: singleLineText} : s
          ));
          
          return {
            ...sub,
            text: singleLineText,
            charCount,
            isLong,
            duration,
            isTooShort,
            isTooLong,
            hasTimecodeConflict: hasConflict,
            recentlyEdited: true,
            editedAt: Date.now(),
            canUndo: true,
            previousText: sub.text
          };
        }
        return sub;
      });
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleUndoSubtitle = useCallback((id: number) => {
    setTranslatedSubtitles(prev => prev.map(sub => {
      if (sub.id === id && sub.previousText) {
        const charCount = sub.previousText.replace(/\n/g, '').length;
        const isLong = charCount > maxTotalChars;
        const duration = calculateDuration(sub.startTime, sub.endTime);
        const isTooShort = duration < minDurationSeconds;
        const isTooLong = duration > maxDurationSeconds;
        return {
          ...sub,
          text: sub.previousText,
          charCount,
          isLong,
          duration,
          isTooShort,
          isTooLong,
          previousText: undefined,
          canUndo: false,
          recentlyEdited: false
        };
      }
      return sub;
    }));
  }, [maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleSplitSubtitle = useCallback((id: number) => {
    setTranslatedSubtitles(prev => {
      const subtitleIndex = prev.findIndex(sub => sub.id === id);
      if (subtitleIndex === -1) return prev;
      
      const subtitle = prev[subtitleIndex];
      const splitResult = splitTextIntelligently(subtitle.text);
      
      if (!splitResult.secondPart) {
        console.log('❌ Cannot split subtitle - insufficient content');
        return prev;
      }
      
      // Calculate new timing
      const timeResult = splitTimeProportionally(
        subtitle.startTime, 
        subtitle.endTime, 
        splitResult.firstRatio
      );
      
      // Create two new subtitles
      const firstSubtitle: Subtitle = {
        ...subtitle,
        text: splitResult.firstPart,
        endTime: timeResult.firstEnd,
        charCount: splitResult.firstPart.replace(/\n/g, '').length,
        isLong: splitResult.firstPart.replace(/\n/g, '').length > maxTotalChars,
        duration: calculateDuration(subtitle.startTime, timeResult.firstEnd),
        isTooShort: calculateDuration(subtitle.startTime, timeResult.firstEnd) < minDurationSeconds,
        isTooLong: calculateDuration(subtitle.startTime, timeResult.firstEnd) > maxDurationSeconds,
        recentlyEdited: true, // Mark as recently edited to keep in view
        editedAt: Date.now(),
        canUndo: false,
        previousText: undefined
      };
      
      const secondSubtitle: Subtitle = {
        ...subtitle,
        id: subtitle.id + 1, // Will be renumbered properly below
        text: splitResult.secondPart,
        startTime: timeResult.secondStart,
        charCount: splitResult.secondPart.replace(/\n/g, '').length,
        isLong: splitResult.secondPart.replace(/\n/g, '').length > maxTotalChars,
        duration: calculateDuration(timeResult.secondStart, subtitle.endTime),
        isTooShort: calculateDuration(timeResult.secondStart, subtitle.endTime) < minDurationSeconds,
        isTooLong: calculateDuration(timeResult.secondStart, subtitle.endTime) > maxDurationSeconds,
        recentlyEdited: true, // Mark as recently edited to keep in view
        editedAt: Date.now(),
        canUndo: false,
        previousText: undefined
      };
      
      // Create new array with split subtitles
      const newSubtitles = [
        ...prev.slice(0, subtitleIndex),
        firstSubtitle,
        secondSubtitle,
        ...prev.slice(subtitleIndex + 1)
      ];
      
      // Renumber all IDs to maintain sequence
      const renumberedSubtitles = newSubtitles.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
      
      console.log(`✂️ Split subtitle ${id} into two parts:`, {
        original: subtitle.text,
        first: splitResult.firstPart,
        second: splitResult.secondPart,
        ratio: splitResult.firstRatio
      });
      console.log(`📋 Split segments marked as 'recently edited' - will remain visible in current filter until manually changed`);
      
      return renumberedSubtitles;
    });
    
    // Also update original subtitles if they exist
    setOriginalSubtitles(prev => {
      if (prev.length === 0) return prev;
      
      const subtitleIndex = prev.findIndex(sub => sub.id === id);
      if (subtitleIndex === -1) return prev;
      
      const subtitle = prev[subtitleIndex];
      const splitResult = splitTextIntelligently(subtitle.text);
      
      if (!splitResult.secondPart) return prev;
      
      const timeResult = splitTimeProportionally(
        subtitle.startTime, 
        subtitle.endTime, 
        splitResult.firstRatio
      );
      
      const firstSubtitle: Subtitle = {
        ...subtitle,
        text: splitResult.firstPart,
        endTime: timeResult.firstEnd,
        charCount: splitResult.firstPart.replace(/\n/g, '').length,
        isLong: splitResult.firstPart.replace(/\n/g, '').length > maxTotalChars,
        duration: calculateDuration(subtitle.startTime, timeResult.firstEnd),
        isTooShort: calculateDuration(subtitle.startTime, timeResult.firstEnd) < minDurationSeconds,
        isTooLong: calculateDuration(subtitle.startTime, timeResult.firstEnd) > maxDurationSeconds,
        recentlyEdited: true, // Mark as recently edited to keep in view
        editedAt: Date.now()
      };
      
      const secondSubtitle: Subtitle = {
        ...subtitle,
        id: subtitle.id + 1,
        text: splitResult.secondPart,
        startTime: timeResult.secondStart,
        charCount: splitResult.secondPart.replace(/\n/g, '').length,
        isLong: splitResult.secondPart.replace(/\n/g, '').length > maxTotalChars,
        duration: calculateDuration(timeResult.secondStart, subtitle.endTime),
        isTooShort: calculateDuration(timeResult.secondStart, subtitle.endTime) < minDurationSeconds,
        isTooLong: calculateDuration(timeResult.secondStart, subtitle.endTime) > maxDurationSeconds,
        recentlyEdited: true, // Mark as recently edited to keep in view
        editedAt: Date.now()
      };
      
      const newSubtitles = [
        ...prev.slice(0, subtitleIndex),
        firstSubtitle,
        secondSubtitle,
        ...prev.slice(subtitleIndex + 1)
      ];
      
      return newSubtitles.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
    });
    
    // Clear global undo since structure changed
    setPreviousSubtitles(null);
  }, [maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleBulkSplitFiltered = useCallback(() => {
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      // Find all subtitles that can be split in the filtered view
      const splittableSubtitles = currentFilteredSubtitles.filter(sub => {
        const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
        return words.length >= 2 && sub.text.trim().length > 10;
      });
      
      if (splittableSubtitles.length === 0) {
        console.log('❌ No splittable subtitles found in filtered view');
        return prev;
      }
      
      console.log(`✂️ Bulk splitting ${splittableSubtitles.length} filtered subtitles`);
      
      // Process each splittable subtitle
      let newSubtitles = [...prev];
      let idOffset = 0; // Track how many new subtitles we've added
      
      // Sort by ID to process in order
      const sortedSplittableIds = splittableSubtitles.map(sub => sub.id).sort((a, b) => a - b);
      
      for (const subtitleId of sortedSplittableIds) {
        const subtitleIndex = newSubtitles.findIndex(sub => sub.id === subtitleId);
        if (subtitleIndex === -1) continue;
        
        const subtitle = newSubtitles[subtitleIndex];
        const splitResult = splitTextIntelligently(subtitle.text);
        
        if (!splitResult.secondPart) continue;
        
        // Calculate new timing
        const timeResult = splitTimeProportionally(
          subtitle.startTime, 
          subtitle.endTime, 
          splitResult.firstRatio
        );
        
        // Create two new subtitles
        const firstSubtitle: Subtitle = {
          ...subtitle,
          text: splitResult.firstPart,
          endTime: timeResult.firstEnd,
          charCount: splitResult.firstPart.replace(/\n/g, '').length,
          isLong: splitResult.firstPart.replace(/\n/g, '').length > maxTotalChars,
          duration: calculateDuration(subtitle.startTime, timeResult.firstEnd),
          isTooShort: calculateDuration(subtitle.startTime, timeResult.firstEnd) < minDurationSeconds,
          isTooLong: calculateDuration(subtitle.startTime, timeResult.firstEnd) > maxDurationSeconds,
          recentlyEdited: true, // Mark as recently edited to keep in view
          editedAt: Date.now(),
          canUndo: false,
          previousText: undefined
        };
        
        const secondSubtitle: Subtitle = {
          ...subtitle,
          id: subtitle.id + 1, // Will be renumbered properly below
          text: splitResult.secondPart,
          startTime: timeResult.secondStart,
          charCount: splitResult.secondPart.replace(/\n/g, '').length,
          isLong: splitResult.secondPart.replace(/\n/g, '').length > maxTotalChars,
          duration: calculateDuration(timeResult.secondStart, subtitle.endTime),
          isTooShort: calculateDuration(timeResult.secondStart, subtitle.endTime) < minDurationSeconds,
          isTooLong: calculateDuration(timeResult.secondStart, subtitle.endTime) > maxDurationSeconds,
          recentlyEdited: true, // Mark as recently edited to keep in view
          editedAt: Date.now(),
          canUndo: false,
          previousText: undefined
        };
        
        // Replace the original subtitle with the two new ones
        newSubtitles = [
          ...newSubtitles.slice(0, subtitleIndex),
          firstSubtitle,
          secondSubtitle,
          ...newSubtitles.slice(subtitleIndex + 1)
        ];
        
        idOffset += 1; // We added one more subtitle
      }
      
      // Renumber all IDs to maintain sequence
      const renumberedSubtitles = newSubtitles.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
      
      console.log(`📋 Bulk split completed - ${splittableSubtitles.length} subtitles split into ${splittableSubtitles.length * 2} segments`);
      console.log(`📋 All split segments marked as 'recently edited' - will remain visible in current filter until manually changed`);
      
      return renumberedSubtitles;
    });
    
    // Also update original subtitles if they exist
    setOriginalSubtitles(prev => {
      if (prev.length === 0) return prev;
      
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      // Find all subtitles that can be split in the filtered view
      const splittableSubtitles = currentFilteredSubtitles.filter(sub => {
        const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
        return words.length >= 2 && sub.text.trim().length > 10;
      });
      
      if (splittableSubtitles.length === 0) return prev;
      
      // Process each splittable subtitle
      let newSubtitles = [...prev];
      
      // Sort by ID to process in order
      const sortedSplittableIds = splittableSubtitles.map(sub => sub.id).sort((a, b) => a - b);
      
      for (const subtitleId of sortedSplittableIds) {
        const subtitleIndex = newSubtitles.findIndex(sub => sub.id === subtitleId);
        if (subtitleIndex === -1) continue;
        
        const subtitle = newSubtitles[subtitleIndex];
        const splitResult = splitTextIntelligently(subtitle.text);
        
        if (!splitResult.secondPart) continue;
        
        const timeResult = splitTimeProportionally(
          subtitle.startTime, 
          subtitle.endTime, 
          splitResult.firstRatio
        );
        
        const firstSubtitle: Subtitle = {
          ...subtitle,
          text: splitResult.firstPart,
          endTime: timeResult.firstEnd,
          charCount: splitResult.firstPart.replace(/\n/g, '').length,
          isLong: splitResult.firstPart.replace(/\n/g, '').length > maxTotalChars,
          duration: calculateDuration(subtitle.startTime, timeResult.firstEnd),
          isTooShort: calculateDuration(subtitle.startTime, timeResult.firstEnd) < minDurationSeconds,
          isTooLong: calculateDuration(subtitle.startTime, timeResult.firstEnd) > maxDurationSeconds,
          recentlyEdited: true,
          editedAt: Date.now()
        };
        
        const secondSubtitle: Subtitle = {
          ...subtitle,
          id: subtitle.id + 1,
          text: splitResult.secondPart,
          startTime: timeResult.secondStart,
          charCount: splitResult.secondPart.replace(/\n/g, '').length,
          isLong: splitResult.secondPart.replace(/\n/g, '').length > maxTotalChars,
          duration: calculateDuration(timeResult.secondStart, subtitle.endTime),
          isTooShort: calculateDuration(timeResult.secondStart, subtitle.endTime) < minDurationSeconds,
          isTooLong: calculateDuration(timeResult.secondStart, subtitle.endTime) > maxDurationSeconds,
          recentlyEdited: true,
          editedAt: Date.now()
        };
        
        newSubtitles = [
          ...newSubtitles.slice(0, subtitleIndex),
          firstSubtitle,
          secondSubtitle,
          ...newSubtitles.slice(subtitleIndex + 1)
        ];
      }
      
      return newSubtitles.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
    });
    
    // Clear global undo since structure changed
    setPreviousSubtitles(null);
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleCascadePreview = useCallback(() => {
    // Calculate current filtered subtitles based on current filter states
    const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
    
    let currentFilteredSubtitles = translatedSubtitles;
    if (hasActiveFilter) {
      currentFilteredSubtitles = translatedSubtitles.filter(sub => {
        const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
        
        if (showErrorsOnly && showLongLinesOnly) {
          return sub.isLong || lineLengthExceeded;
        }
        if (showErrorsOnly) {
          return sub.isLong;
        }
        if (showLongLinesOnly) {
          return lineLengthExceeded;
        }
        if (showTooShortOnly) {
          return sub.isTooShort;
        }
        if (showTooLongOnly) {
          return sub.isTooLong;
        }
        if (showTimecodeConflictsOnly) {
          return sub.hasTimecodeConflict;
        }
        return false; 
      });
    }
    
    // Calculate cascade plan for filtered subtitles
    const plan = calculateCascadePlan(currentFilteredSubtitles, minDurationSeconds);
    setCascadePreview(plan);
    setShowCascadePreview(true);
    
    console.log(`🔍 Cascade preview calculated:`, plan);
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds]);

  const handleApplyCascadeFix = useCallback(() => {
    if (!cascadePreview || !cascadePreview.canBeFixed) {
      console.log('❌ Cannot apply cascade fix - invalid plan');
      return;
    }
    
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      try {
        const fixedSubtitles = applyCascadeFix(currentFilteredSubtitles, minDurationSeconds);
        
        // Merge the fixed subtitles back into the full list
        const result = [...prev];
        fixedSubtitles.forEach(fixedSub => {
          const index = result.findIndex(sub => sub.id === fixedSub.id);
          if (index !== -1) {
            result[index] = fixedSub;
          }
        });
        
        // Recalculate conflicts for all subtitles
        const finalSubtitles = result.map(sub => {
          const hasConflict = hasTimecodeConflict(sub, result);
          return {
            ...sub,
            hasTimecodeConflict: hasConflict
          };
        });
        
        console.log(`✅ Cascade fix applied successfully to ${cascadePreview.totalAffected} segments`);
        setShowCascadePreview(false);
        setCascadePreview(null);
        
        return finalSubtitles;
      } catch (error) {
        console.error('❌ Error applying cascade fix:', error);
        return prev;
      }
    });
  }, [cascadePreview, translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds]);

  const handleFixTimecodeConflicts = useCallback(() => {
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      // Calculate current filtered subtitles based on current filter states
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredSubtitles = prev;
      if (hasActiveFilter) {
        currentFilteredSubtitles = prev.filter(sub => {
          const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
          
          if (showErrorsOnly && showLongLinesOnly) {
            return sub.isLong || lineLengthExceeded;
          }
          if (showErrorsOnly) {
            return sub.isLong;
          }
          if (showLongLinesOnly) {
            return lineLengthExceeded;
          }
          if (showTooShortOnly) {
            return sub.isTooShort;
          }
          if (showTooLongOnly) {
            return sub.isTooLong;
          }
          if (showTimecodeConflictsOnly) {
            return sub.hasTimecodeConflict;
          }
          return false; 
        });
      }
      
      // Find all subtitles with timecode conflicts in the filtered view
      const conflictingSubtitles = currentFilteredSubtitles.filter(sub => sub.hasTimecodeConflict);
      
      if (conflictingSubtitles.length === 0) {
        console.log('❌ No timecode conflicts found in filtered view');
        return prev;
      }
      
      console.log(`🔧 Fixing timecode conflicts for ${conflictingSubtitles.length} filtered subtitles`);
      
      // Process each conflicting subtitle
      let newSubtitles = [...prev];
      
      // Sort by ID to process in order
      const sortedConflictingIds = conflictingSubtitles.map(sub => sub.id).sort((a, b) => a - b);
      
      for (const subtitleId of sortedConflictingIds) {
        const subtitleIndex = newSubtitles.findIndex(sub => sub.id === subtitleId);
        if (subtitleIndex === -1) continue;
        
        const subtitle = newSubtitles[subtitleIndex];
        
        // Reduce end time by 1ms
        const newEndTime = reduceTimecodeByOneMs(subtitle.endTime);
        
        // Update the subtitle
        newSubtitles[subtitleIndex] = {
          ...subtitle,
          endTime: newEndTime,
          duration: calculateDuration(subtitle.startTime, newEndTime),
          isTooShort: calculateDuration(subtitle.startTime, newEndTime) < minDurationSeconds,
          isTooLong: calculateDuration(subtitle.startTime, newEndTime) > maxDurationSeconds,
          recentlyEdited: true,
          editedAt: Date.now(),
          canUndo: true,
          previousText: subtitle.text
        };
      }
      
      // Recalculate conflicts after changes
      const finalSubtitles = newSubtitles.map(sub => {
        const hasConflict = hasTimecodeConflict(sub, newSubtitles);
        return {
          ...sub,
          hasTimecodeConflict: hasConflict
        };
      });
      
      console.log(`📋 Timecode conflicts fixed - reduced end times by 1ms for ${conflictingSubtitles.length} subtitles`);
      console.log(`📋 Fixed segments marked as 'recently edited' - will remain visible in current filter until manually changed`);
      
      return finalSubtitles;
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);
  
  const hasTotalLengthErrors = useMemo(() => translatedSubtitles.some(sub => sub.isLong), [translatedSubtitles]);
  
  const hasLongLines = useMemo(() => 
    translatedSubtitles.some(sub => 
      sub.text.split('\n').some(line => line.length > maxLineChars)
    ), [translatedSubtitles, maxLineChars]);

  const hasTooShortSegments = useMemo(() => 
    translatedSubtitles.some(sub => sub.isTooShort), [translatedSubtitles]);

  const hasTooLongSegments = useMemo(() => 
    translatedSubtitles.some(sub => sub.isTooLong), [translatedSubtitles]);

  const hasTimecodeConflicts = useMemo(() => 
    translatedSubtitles.some(sub => sub.hasTimecodeConflict), [translatedSubtitles]);

  const filteredSubtitles = useMemo(() => {
    const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;

    console.log('🔍 Filter Debug:', {
      hasActiveFilter,
      translatedSubtitlesLength: translatedSubtitles.length,
      showErrorsOnly,
      showLongLinesOnly,
      showTooShortOnly,
      showTooLongOnly,
      showTimecodeConflictsOnly
    });

    if (!hasActiveFilter) {
      return translatedSubtitles;
    }

    return translatedSubtitles.filter(sub => {
      const lineLengthExceeded = sub.text.split('\n').some(line => line.length > maxLineChars);
      
      // Always show recently edited items (sticky behavior)
      if (sub.recentlyEdited) {
        return true;
      }
      
      if (showErrorsOnly && showLongLinesOnly) {
        return sub.isLong || lineLengthExceeded;
      }
      if (showErrorsOnly) {
        return sub.isLong;
      }
      if (showLongLinesOnly) {
        return lineLengthExceeded;
      }
      if (showTooShortOnly) {
        return sub.isTooShort;
      }
      if (showTooLongOnly) {
        return sub.isTooLong;
      }
      if (showTimecodeConflictsOnly) {
        return sub.hasTimecodeConflict;
      }
      return false; 
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxLineChars]);

  const hasMultiLineInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.text.includes('\n')), [filteredSubtitles]);

  const hasLongLinesInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.text.split('\n').some(line => line.length > maxLineChars)), [filteredSubtitles, maxLineChars]);

  const hasSplittableInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => {
      const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
      return words.length >= 2 && sub.text.trim().length > 10;
    }), [filteredSubtitles]);

  const hasTimecodeConflictsInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.hasTimecodeConflict), [filteredSubtitles]);

  const canUndo = previousSubtitles !== null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <Header 
        onDownload={handleDownload}
        onDownloadAll={() => {}} // Not used in single-document mode
        hasTranslatedSubs={translatedSubtitles.length > 0}
        hasMultipleDocuments={false} // Single-document mode
        onUndo={handleUndo}
        canUndo={canUndo}
        onClearSession={handleClearSession}
        maxTotalChars={maxTotalChars}
        maxLineChars={maxLineChars}
        minDurationSeconds={minDurationSeconds}
        maxDurationSeconds={maxDurationSeconds}
      />

      <main className="flex-grow container mx-auto p-4 md:p-8">
        {translatedSubtitles.length === 0 ? (
          <div className="text-center mt-16 max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <p className="text-gray-400 text-lg mb-8">
              Upload your translated .srt file to begin. You can also upload an original version for side-by-side comparison.
              The app will automatically flag lines longer than the specified character limits and help you fix them.
            </p>
            
            {/* Character Limit Settings */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Character Limits</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="maxTotalChars" className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Total Characters
                  </label>
                  <input
                    type="number"
                    id="maxTotalChars"
                    value={maxTotalChars}
                    onChange={(e) => setMaxTotalChars(Number(e.target.value))}
                    min="1"
                    max="200"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="maxLineChars" className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Characters Per Line
                  </label>
                  <input
                    type="number"
                    id="maxLineChars"
                    value={maxLineChars}
                    onChange={(e) => setMaxLineChars(Number(e.target.value))}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Duration Limit Settings */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Duration Limits</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="minDurationSeconds" className="block text-sm font-medium text-gray-300 mb-2">
                    Minimum Duration (seconds)
                  </label>
                  <input
                    type="number"
                    id="minDurationSeconds"
                    value={minDurationSeconds}
                    onChange={(e) => setMinDurationSeconds(Number(e.target.value))}
                    min="0.1"
                    max="10"
                    step="0.1"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="maxDurationSeconds" className="block text-sm font-medium text-gray-300 mb-2">
                    Maximum Duration (seconds)
                  </label>
                  <input
                    type="number"
                    id="maxDurationSeconds"
                    value={maxDurationSeconds}
                    onChange={(e) => setMaxDurationSeconds(Number(e.target.value))}
                    min="1"
                    max="30"
                    step="0.1"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8 justify-center">
              <FileUpload label="Upload Translated SRT" onFileUpload={(c, n) => handleFileUpload(c, 'translated', n)} />
              <FileUpload label="Upload Original SRT (Optional)" onFileUpload={(c, n) => handleFileUpload(c, 'original', n)} />
            </div>
          </div>
        ) : (
          <SubtitleEditor 
            subtitles={filteredSubtitles}
            showOriginal={showOriginal && originalSubtitles.length > 0}
            setShowOriginal={setShowOriginal}
            showTimecodes={showTimecodes}
            setShowTimecodes={setShowTimecodes}
            hasTotalLengthErrors={hasTotalLengthErrors}
            showErrorsOnly={showErrorsOnly}
            setShowErrorsOnly={setShowErrorsOnly}
            hasLongLines={hasLongLines}
            showLongLinesOnly={showLongLinesOnly}
            setShowLongLinesOnly={setShowLongLinesOnly}
            hasTooShortSegments={hasTooShortSegments}
            showTooShortOnly={showTooShortOnly}
            setShowTooShortOnly={setShowTooShortOnly}
            hasTooLongSegments={hasTooLongSegments}
            showTooLongOnly={showTooLongOnly}
            setShowTooLongOnly={setShowTooLongOnly}
            hasTimecodeConflicts={hasTimecodeConflicts}
            showTimecodeConflictsOnly={showTimecodeConflictsOnly}
            setShowTimecodeConflictsOnly={setShowTimecodeConflictsOnly}
            hasMultiLineInFiltered={hasMultiLineInFiltered}
            onRemoveBreaksFromFiltered={handleRemoveBreaksFromFiltered}
            hasLongLinesInFiltered={hasLongLinesInFiltered}
            onSplitFilteredLines={handleSplitFilteredLines}
            hasSplittableInFiltered={hasSplittableInFiltered}
            onBulkSplitFiltered={handleBulkSplitFiltered}
            hasTimecodeConflictsInFiltered={hasTimecodeConflictsInFiltered}
            onFixTimecodeConflicts={handleFixTimecodeConflicts}
            onCascadePreview={handleCascadePreview}
            onApplyCascadeFix={handleApplyCascadeFix}
            cascadePreview={cascadePreview}
            showCascadePreview={showCascadePreview}
            onCloseCascadePreview={() => setShowCascadePreview(false)}
            onMergeNext={handleMergeSubtitleWithNext}
            onShowAll={handleShowAll}
            onUpdateSubtitle={handleUpdateSubtitle}
            onUpdateTimecode={handleUpdateTimecode}
            onUndoSubtitle={handleUndoSubtitle}
            onSplitSubtitle={handleSplitSubtitle}
            maxTotalChars={maxTotalChars}
            maxLineChars={maxLineChars}
            minDurationSeconds={minDurationSeconds}
            maxDurationSeconds={maxDurationSeconds}
          />
        )}
        
        {/* Cascade Preview Modal */}
        {showCascadePreview && cascadePreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">🔧 Smart Cascade Fix Preview</h3>
                  <button
                    onClick={() => setShowCascadePreview(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                
                {cascadePreview.canBeFixed ? (
                  <div className="space-y-4">
                    <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
                      <p className="text-green-400 font-medium">
                        ✅ Can fix {cascadePreview.totalAffected} segments using cascade adjustment
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-lg font-medium text-white">Planned Changes:</h4>
                      {cascadePreview.steps.map((step, index) => (
                        <div key={index} className="bg-gray-700 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium">Segment #{step.subtitleId}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              step.action === 'extend' ? 'bg-green-600 text-white' :
                              step.action === 'shorten' ? 'bg-yellow-600 text-white' :
                              'bg-blue-600 text-white'
                            }`}>
                              {step.action === 'extend' ? 'Extend' : 
                               step.action === 'shorten' ? 'Shorten' : 'Move'} 
                              {step.timeChange.toFixed(3)}s
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mt-1">{step.reason}</p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleApplyCascadeFix}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                      >
                        ✅ Apply Cascade Fix
                      </button>
                      <button
                        onClick={() => setShowCascadePreview(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                    <p className="text-red-400 font-medium">
                      ❌ Cannot fix automatically: {cascadePreview.reason}
                    </p>
                    <p className="text-gray-300 text-sm mt-2">
                      You may need to manually adjust timecodes or use the simple "Fix Conflicts" button.
                    </p>
                    <button
                      onClick={() => setShowCascadePreview(false)}
                      className="mt-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;