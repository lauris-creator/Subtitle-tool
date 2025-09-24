import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Subtitle } from './types';
import { parseSrt, formatSrt } from './services/srtParser';
import { sessionManager } from './services/sessionManager';
import { splitTextIntelligently, splitLineIntelligently, cleanSpaces, hasFormatErrors } from './utils/textUtils';
import { splitTimeProportionally, calculateDuration } from './utils/timeUtils';
import { hasTimecodeConflict, parseTimecodeInput, reduceTimecodeByOneMs, timecodeToSeconds, secondsToTimecode, addSecondsToTimecode } from './utils/timecodeUtils';
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
  const [showErrorsOnly, setShowErrorsOnly] = useState<boolean>(false);
  const [showLongLinesOnly, setShowLongLinesOnly] = useState<boolean>(false);
  const [showTooShortOnly, setShowTooShortOnly] = useState<boolean>(false);
  const [showTooLongOnly, setShowTooLongOnly] = useState<boolean>(false);
  const [showTimecodeConflictsOnly, setShowTimecodeConflictsOnly] = useState<boolean>(false);
  const [showFormatErrorsOnly, setShowFormatErrorsOnly] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [sessionRestored, setSessionRestored] = useState<boolean>(false);
  const [maxTotalChars, setMaxTotalChars] = useState<number>(MAX_TOTAL_CHARS);
  const [maxLineChars, setMaxLineChars] = useState<number>(MAX_LINE_CHARS);
  const [minDurationSeconds, setMinDurationSeconds] = useState<number>(1);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>(7);
  
  // Multi-file support
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [currentFileFilter, setCurrentFileFilter] = useState<string | null>(null);

  // Restore session on component mount
  useEffect(() => {
    const savedSession = sessionManager.loadSession();
    if (savedSession) {
      setOriginalSubtitles(savedSession.originalSubtitles);
      setTranslatedSubtitles(savedSession.translatedSubtitles);
      setFileName(savedSession.fileName);
      setAvailableFiles(savedSession.availableFiles || []); // Restore available files
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
        availableFiles,
        maxTotalChars,
        maxLineChars,
        minDurationSeconds,
        maxDurationSeconds
      });
    }
  }, [originalSubtitles, translatedSubtitles, fileName, availableFiles, sessionRestored, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

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
    const subs = parseSrt(content, name);
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
      // Add file to available files list
      setAvailableFiles(prev => prev.includes(name) ? prev : [...prev, name]);
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

  const handleMultiFileUpload = (files: Array<{content: string, name: string}>, type: 'original' | 'translated') => {
    console.log(`📁 Multi-file upload: ${files.length} files`);
    
    // Parse all files and concatenate them
    let allSubtitles: Subtitle[] = [];
    let fileNames: string[] = [];
    
    files.forEach((file, fileIndex) => {
      const subs = parseSrt(file.content, file.name);
      fileNames.push(file.name);
      
      // Renumber IDs to be sequential across all files
      const renumberedSubs = subs.map((sub, subIndex) => ({
        ...sub,
        id: allSubtitles.length + subIndex + 1
      }));
      
      allSubtitles = [...allSubtitles, ...renumberedSubs];
    });
    
    // Recalculate conflicts for all subtitles
    allSubtitles = allSubtitles.map(sub => ({
      ...sub,
      hasTimecodeConflict: hasTimecodeConflict(sub, allSubtitles)
    }));
    
    setPreviousSubtitles(null); // Clear undo history on new file upload
    
    if (type === 'translated') {
      // Apply current character limits and duration validation to parsed subtitles
      const processedSubs = allSubtitles.map(sub => {
        const charCount = sub.text.replace(/\n/g, '').length;
        const isLong = charCount > maxTotalChars;
        const duration = calculateDuration(sub.startTime, sub.endTime);
        const isTooShort = duration < minDurationSeconds;
        const isTooLong = duration > maxDurationSeconds;
        return {
          ...sub,
          charCount,
          isLong,
          duration,
          isTooShort,
          isTooLong
        };
      });
      
      setTranslatedSubtitles(processedSubs);
      setFileName(files.length === 1 ? files[0].name : `${files.length} files`);
      setAvailableFiles(fileNames);
      
      console.log(`📁 Concatenated ${allSubtitles.length} subtitles from ${files.length} files`);
    } else {
      setOriginalSubtitles(allSubtitles);
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
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
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
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
  }, [maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleMergeSubtitleWithNext = useCallback((id: number) => {
    setTranslatedSubtitles(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1 || index === prev.length - 1) return prev; // nothing to merge

      const current = prev[index];
      const next = prev[index + 1];

      const mergedText = cleanSpaces(`${current.text} ${next.text}`);
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

      const mergedText = cleanSpaces(`${current.text} ${next.text}`);
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

  const handleBulkMergeFiltered = useCallback(() => {
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
      
      if (currentFilteredSubtitles.length < 2) {
        console.log('🔗 Bulk merge: Need at least 2 filtered segments');
        return prev;
      }
      
      // Get the IDs of filtered subtitles in order
      const filteredIds = currentFilteredSubtitles.map(sub => sub.id).sort((a, b) => a - b);
      console.log(`🔗 Bulk merge: Processing ${filteredIds.length} filtered segments: ${filteredIds.join(', ')}`);
      
      // Group consecutive IDs into pairs: [1,2], [5,6], [14,15], etc.
      const mergePairs: Array<[number, number]> = [];
      for (let i = 0; i < filteredIds.length - 1; i += 2) {
        const currentId = filteredIds[i];
        const nextId = filteredIds[i + 1];
        
        // Check if they are consecutive
        if (nextId === currentId + 1) {
          mergePairs.push([currentId, nextId]);
        }
      }
      
      if (mergePairs.length === 0) {
        console.log('🔗 Bulk merge: No consecutive pairs found in filtered segments');
        return prev;
      }
      
      console.log(`🔗 Bulk merge: Found ${mergePairs.length} consecutive pairs to merge:`, mergePairs);
      
      // Start with a copy of the original subtitles
      let newSubtitles = [...prev];
      
      // Process merge pairs from highest IDs to lowest to avoid index shifting issues
      mergePairs.reverse().forEach(([firstId, secondId]) => {
        const firstIndex = newSubtitles.findIndex(s => s.id === firstId);
        const secondIndex = newSubtitles.findIndex(s => s.id === secondId);
        
        if (firstIndex === -1 || secondIndex === -1) return;
        
        const first = newSubtitles[firstIndex];
        const second = newSubtitles[secondIndex];
        
        // Merge the subtitles
        const mergedText = cleanSpaces(`${first.text} ${second.text}`);
        const mergedStart = first.startTime;
        const mergedEnd = second.endTime;
        
        const charCount = mergedText.replace(/\n/g, '').length;
        const duration = calculateDuration(mergedStart, mergedEnd);
        
        const merged: Subtitle = {
          ...first,
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
        
        // Replace first with merged, remove second
        newSubtitles = [
          ...newSubtitles.slice(0, firstIndex),
          merged,
          ...newSubtitles.slice(firstIndex + 1, secondIndex),
          ...newSubtitles.slice(secondIndex + 1)
        ];
      });
      
      // Renumber all subtitles and recompute conflicts
      const renumbered = newSubtitles.map((sub, i) => ({ ...sub, id: i + 1 }));
      const recomputed = renumbered.map(s => ({
        ...s,
        hasTimecodeConflict: hasTimecodeConflict(s, renumbered)
      }));
      
      console.log(`🔗 Bulk merge: Completed ${mergePairs.length} merges`);
      return recomputed;
    });
    
    // Merge originals if present
    setOriginalSubtitles(prev => {
      if (prev.length === 0) return prev;
      
      // Apply the same merge logic to originals
      const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly;
      
      let currentFilteredOriginals = prev;
      if (hasActiveFilter) {
        currentFilteredOriginals = prev.filter(sub => {
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
      
      if (currentFilteredOriginals.length < 2) return prev;
      
      const filteredIds = currentFilteredOriginals.map(sub => sub.id).sort((a, b) => a - b);
      const mergePairs: Array<[number, number]> = [];
      for (let i = 0; i < filteredIds.length - 1; i += 2) {
        const currentId = filteredIds[i];
        const nextId = filteredIds[i + 1];
        if (nextId === currentId + 1) {
          mergePairs.push([currentId, nextId]);
        }
      }
      
      if (mergePairs.length === 0) return prev;
      
      let newOriginals = [...prev];
      mergePairs.reverse().forEach(([firstId, secondId]) => {
        const firstIndex = newOriginals.findIndex(s => s.id === firstId);
        const secondIndex = newOriginals.findIndex(s => s.id === secondId);
        
        if (firstIndex === -1 || secondIndex === -1) return;
        
        const first = newOriginals[firstIndex];
        const second = newOriginals[secondIndex];
        
        const mergedText = cleanSpaces(`${first.text} ${second.text}`);
        const merged = { ...first, text: mergedText, endTime: second.endTime };
        
        newOriginals = [
          ...newOriginals.slice(0, firstIndex),
          merged,
          ...newOriginals.slice(firstIndex + 1, secondIndex),
          ...newOriginals.slice(secondIndex + 1)
        ];
      });
      
      return newOriginals.map((sub, index) => ({ ...sub, id: index + 1 }));
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleDownload = async () => {
    if (translatedSubtitles.length === 0) return;
    
    // If multiple files are loaded, download individual files
    if (availableFiles.length > 1) {
      console.log(`📦 Downloading ${availableFiles.length} individual files`);
      
      // Group subtitles by source file
      const subtitlesByFile = new Map<string, Subtitle[]>();
      translatedSubtitles.forEach(sub => {
        if (sub.sourceFile) {
          if (!subtitlesByFile.has(sub.sourceFile)) {
            subtitlesByFile.set(sub.sourceFile, []);
          }
          subtitlesByFile.get(sub.sourceFile)!.push(sub);
        }
      });
      
      // Create individual SRT files
      const files: Array<{name: string, content: string}> = [];
      subtitlesByFile.forEach((subs, fileName) => {
        // Renumber IDs for each file (1, 2, 3...)
        const renumberedSubs = subs.map((sub, index) => ({
          ...sub,
          id: index + 1
        }));
        
        const srtContent = formatSrt(renumberedSubs);
        const contentWithBOM = '\uFEFF' + srtContent;
        const editedFileName = fileName.replace('.srt', '_edited.srt');
        
        files.push({
          name: editedFileName,
          content: contentWithBOM
        });
      });
      
      // Create ZIP file
      try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        files.forEach(file => {
          zip.file(file.name, file.content);
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited_subtitles_${files.length}_files.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`📦 Downloaded ZIP with ${files.length} individual files`);
      } catch (error) {
        console.error('Error creating ZIP:', error);
        alert('Error creating ZIP file. Please try downloading individual files.');
      }
    } else {
      // Single file - download as before
      const srtContent = formatSrt(translatedSubtitles);
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
    }
  };

  const handleDownloadAll = async () => {
    if (translatedSubtitles.length === 0 || availableFiles.length === 0) return;
    
    console.log(`📦 Creating ZIP with ${availableFiles.length} files`);
    
    // Group subtitles by source file
    const subtitlesByFile = new Map<string, Subtitle[]>();
    translatedSubtitles.forEach(sub => {
      if (sub.sourceFile) {
        if (!subtitlesByFile.has(sub.sourceFile)) {
          subtitlesByFile.set(sub.sourceFile, []);
        }
        subtitlesByFile.get(sub.sourceFile)!.push(sub);
      }
    });
    
    // Create individual SRT files
    const files: Array<{name: string, content: string}> = [];
    subtitlesByFile.forEach((subs, fileName) => {
      // Renumber IDs for each file
      const renumberedSubs = subs.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
      
      const srtContent = formatSrt(renumberedSubs);
      const contentWithBOM = '\uFEFF' + srtContent;
      const editedFileName = fileName.replace('.srt', '_edited.srt');
      
      files.push({
        name: editedFileName,
        content: contentWithBOM
      });
    });
    
    // Create ZIP file
    try {
      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      files.forEach(file => {
        zip.file(file.name, file.content);
      });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_subtitles_${files.length}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`📦 Downloaded ZIP with ${files.length} files`);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      alert('Error creating ZIP file. Please try downloading individual files.');
    }
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
      console.log("↩️ Global undo: Restored previous state");
    }
  };

  const handleClearSession = () => {
    if (confirm('Are you sure you want to start fresh? This will clear all current work.')) {
      sessionManager.clearSession();
      setOriginalSubtitles([]);
      setTranslatedSubtitles([]);
      setPreviousSubtitles(null);
      setFileName('');
      setAvailableFiles([]); // Clear available files
      setCurrentFileFilter(null); // Clear file filter
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
    setShowFormatErrorsOnly(false);
  };

  const handleFileFilterChange = (fileName: string | null) => {
    setCurrentFileFilter(fileName);
    console.log(`📁 File filter changed to: ${fileName || 'All Files'}`);
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
          const singleLineText = sub.text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
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
        // Skip segments that are at or under 1 second to avoid making them too short
        if (subtitle.duration <= minDurationSeconds) {
          console.log(`⏭️ Skipping segment #${subtitle.id} - duration ${subtitle.duration}s is at or under minimum ${minDurationSeconds}s`);
          continue;
        }
        
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

  const handleFixTooShortSegments = useCallback(() => {
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
      
      // Find all subtitles that are too short in the filtered view
      const tooShortSubtitles = currentFilteredSubtitles.filter(sub => sub.isTooShort);
      
      if (tooShortSubtitles.length === 0) {
        console.log('❌ No too short segments found in filtered view');
        return prev;
      }
      
      console.log(`🔧 Fixing too short segments for ${tooShortSubtitles.length} filtered subtitles`);
      
      // Process each too short subtitle
      let newSubtitles = [...prev];
      
      // Sort by ID to process in order
      const sortedTooShortIds = tooShortSubtitles.map(sub => sub.id).sort((a, b) => a - b);
      
      for (const subtitleId of sortedTooShortIds) {
        const subtitleIndex = newSubtitles.findIndex(sub => sub.id === subtitleId);
        if (subtitleIndex === -1) continue;
        
        const subtitle = newSubtitles[subtitleIndex];
        
        // Calculate new end time to make duration exactly minDurationSeconds
        // Use precise timecode arithmetic to avoid floating-point precision issues
        const newEndTime = addSecondsToTimecode(subtitle.startTime, minDurationSeconds);
        
        // Update the subtitle
        newSubtitles[subtitleIndex] = {
          ...subtitle,
          endTime: newEndTime,
          duration: minDurationSeconds,
          isTooShort: false,
          isTooLong: minDurationSeconds > maxDurationSeconds,
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
      
      console.log(`📋 Too short segments fixed - extended to ${minDurationSeconds}s for ${tooShortSubtitles.length} subtitles`);
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

  const hasFormatErrorsInSubtitles = useMemo(() => 
    translatedSubtitles.some(sub => hasFormatErrors(sub.text)), [translatedSubtitles]);

  const filteredSubtitles = useMemo(() => {
    const hasActiveFilter = showErrorsOnly || showLongLinesOnly || showTooShortOnly || showTooLongOnly || showTimecodeConflictsOnly || showFormatErrorsOnly;
    const hasFileFilter = currentFileFilter !== null;

    console.log('🔍 Filter Debug:', {
      hasActiveFilter,
      hasFileFilter,
      currentFileFilter,
      translatedSubtitlesLength: translatedSubtitles.length,
      showErrorsOnly,
      showLongLinesOnly,
      showTooShortOnly,
      showTooLongOnly,
      showTimecodeConflictsOnly,
      showFormatErrorsOnly
    });

    // First apply file filter if active
    let fileFilteredSubtitles = translatedSubtitles;
    if (hasFileFilter) {
      fileFilteredSubtitles = translatedSubtitles.filter(sub => sub.sourceFile === currentFileFilter);
      console.log(`📁 File filter applied: ${fileFilteredSubtitles.length} subtitles from ${currentFileFilter}`);
    }

    // Then apply content filters if active
    if (!hasActiveFilter) {
      return fileFilteredSubtitles;
    }

    // Special handling for format errors filter - need to include adjacent segments
    if (showFormatErrorsOnly) {
      const formatErrorSubtitleIds = new Set<number>();
      
      // Find all subtitles with format errors
      fileFilteredSubtitles.forEach((sub, index) => {
        if (sub.recentlyEdited || hasFormatErrors(sub.text)) {
          // Add the problematic subtitle
          formatErrorSubtitleIds.add(sub.id);
          
          // Add previous subtitle (if exists)
          if (index > 0) {
            formatErrorSubtitleIds.add(fileFilteredSubtitles[index - 1].id);
          }
          
          // Add next subtitle (if exists)
          if (index < fileFilteredSubtitles.length - 1) {
            formatErrorSubtitleIds.add(fileFilteredSubtitles[index + 1].id);
          }
        }
      });
      
      return fileFilteredSubtitles.filter(sub => formatErrorSubtitleIds.has(sub.id));
    }

    return fileFilteredSubtitles.filter(sub => {
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
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, showFormatErrorsOnly, maxLineChars, currentFileFilter]);

  const hasMultiLineInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.text.includes('\n')), [filteredSubtitles]);

  const hasLongLinesInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.text.split('\n').some(line => line.length > maxLineChars)), [filteredSubtitles, maxLineChars]);

  const hasSplittableInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => {
      const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
      return words.length >= 2 && sub.text.trim().length > 10;
    }), [filteredSubtitles]);

  const handleBulkSplitFiltered = useCallback(() => {
    // Find all subtitles that can be split in the filtered view
    const splittableSubtitles = filteredSubtitles.filter(sub => {
      const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
      return words.length >= 2 && sub.text.trim().length > 10;
    });
    
    if (splittableSubtitles.length === 0) {
      console.log('❌ No splittable subtitles found in filtered view');
      return;
    }
    
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    setTranslatedSubtitles(prev => {
      console.log(`✂️ Bulk splitting ${splittableSubtitles.length} filtered subtitles`);
      
      // Process each splittable subtitle
      let newSubtitles = [...prev];
      
      // Sort by ID in REVERSE order to avoid index shifting issues
      const sortedSplittableIds = splittableSubtitles.map(sub => sub.id).sort((a, b) => b - a);
      
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
      
      // Use the same splittable subtitle IDs that were processed for translated subtitles
      // to ensure consistency between original and translated subtitles
      const splittableIds = splittableSubtitles.map(sub => sub.id);
      const originalSplittableSubtitles = prev.filter(sub => splittableIds.includes(sub.id));
      
      if (originalSplittableSubtitles.length === 0) return prev;
      
      // Process each splittable subtitle
      let newSubtitles = [...prev];
      
      // Sort by ID in REVERSE order to avoid index shifting issues
      const sortedSplittableIds = originalSplittableSubtitles.map(sub => sub.id).sort((a, b) => b - a);
      
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
  }, [translatedSubtitles, filteredSubtitles, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const hasTimecodeConflictsInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.hasTimecodeConflict), [filteredSubtitles]);

  const hasTooShortSegmentsInFiltered = useMemo(() => 
    filteredSubtitles.some(sub => sub.isTooShort), [filteredSubtitles]);

  const hasConsecutivePairsInFiltered = useMemo(() => {
    if (filteredSubtitles.length < 2) return false;
    
    const filteredIds = filteredSubtitles.map(sub => sub.id).sort((a, b) => a - b);
    
    // Check if there are any consecutive pairs
    for (let i = 0; i < filteredIds.length - 1; i += 2) {
      const currentId = filteredIds[i];
      const nextId = filteredIds[i + 1];
      if (nextId === currentId + 1) {
        return true;
      }
    }
    return false;
  }, [filteredSubtitles]);

  const canUndo = previousSubtitles !== null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <Header 
        onDownload={handleDownload}
        hasTranslatedSubs={translatedSubtitles.length > 0}
        onUndo={handleUndo}
        canUndo={canUndo}
        onClearSession={handleClearSession}
        maxTotalChars={maxTotalChars}
        maxLineChars={maxLineChars}
        minDurationSeconds={minDurationSeconds}
        maxDurationSeconds={maxDurationSeconds}
        availableFiles={availableFiles}
        currentFileFilter={currentFileFilter}
        onFileFilterChange={handleFileFilterChange}
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
              <FileUpload 
                label="Upload Translated SRT" 
                onFileUpload={(c, n) => handleFileUpload(c, 'translated', n)} 
                onMultiFileUpload={(files) => handleMultiFileUpload(files, 'translated')}
                multiple={true}
              />
              <FileUpload 
                label="Upload Original SRT (Optional)" 
                onFileUpload={(c, n) => handleFileUpload(c, 'original', n)} 
                onMultiFileUpload={(files) => handleMultiFileUpload(files, 'original')}
                multiple={true}
              />
            </div>
          </div>
        ) : (
          <SubtitleEditor 
            subtitles={filteredSubtitles}
            allSubtitles={translatedSubtitles}
            showOriginal={showOriginal && originalSubtitles.length > 0}
            setShowOriginal={setShowOriginal}
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
            hasFormatErrors={hasFormatErrorsInSubtitles}
            showFormatErrorsOnly={showFormatErrorsOnly}
            setShowFormatErrorsOnly={setShowFormatErrorsOnly}
            hasMultiLineInFiltered={hasMultiLineInFiltered}
            onRemoveBreaksFromFiltered={handleRemoveBreaksFromFiltered}
            hasLongLinesInFiltered={hasLongLinesInFiltered}
            onSplitFilteredLines={handleSplitFilteredLines}
            hasSplittableInFiltered={hasSplittableInFiltered}
            onBulkSplitFiltered={handleBulkSplitFiltered}
            hasTimecodeConflictsInFiltered={hasTimecodeConflictsInFiltered}
            onFixTimecodeConflicts={handleFixTimecodeConflicts}
            hasTooShortSegmentsInFiltered={hasTooShortSegmentsInFiltered}
            onFixTooShortSegments={handleFixTooShortSegments}
            hasConsecutivePairsInFiltered={hasConsecutivePairsInFiltered}
            onBulkMergeFiltered={handleBulkMergeFiltered}
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
      </main>
    </div>
  );
};

export default App;