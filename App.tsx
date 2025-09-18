import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Document, SessionData, Subtitle } from './types';
import { parseSrt, formatSrt } from './services/srtParser';
import { sessionManager } from './services/sessionManager';
import { splitTextIntelligently, splitLineIntelligently } from './utils/textUtils';
import { splitTimeProportionally, calculateDuration } from './utils/timeUtils';
import { hasTimecodeConflict, parseTimecodeInput, reduceTimecodeByOneMs } from './utils/timecodeUtils';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import SubtitleEditor from './components/SubtitleEditor';
import DocumentSelector from './components/DocumentSelector';
import Logo from './components/Logo';
import { MAX_LINE_CHARS, MAX_TOTAL_CHARS } from './constants';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [previousSubtitles, setPreviousSubtitles] = useState<Subtitle[] | null>(null); // For undo
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [showTimecodes, setShowTimecodes] = useState<boolean>(true);
  const [showErrorsOnly, setShowErrorsOnly] = useState<boolean>(false);
  const [showLongLinesOnly, setShowLongLinesOnly] = useState<boolean>(false);
  const [showTooShortOnly, setShowTooShortOnly] = useState<boolean>(false);
  const [showTooLongOnly, setShowTooLongOnly] = useState<boolean>(false);
  const [showTimecodeConflictsOnly, setShowTimecodeConflictsOnly] = useState<boolean>(false);
  const [sessionRestored, setSessionRestored] = useState<boolean>(false);
  const [maxTotalChars, setMaxTotalChars] = useState<number>(MAX_TOTAL_CHARS);
  const [maxLineChars, setMaxLineChars] = useState<number>(MAX_LINE_CHARS);
  const [minDurationSeconds, setMinDurationSeconds] = useState<number>(1);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number>(7);

  // Get current document
  const currentDocument = useMemo(() => 
    documents.find(doc => doc.id === currentDocumentId) || null, 
    [documents, currentDocumentId]
  );

  // Get current subtitles
  const translatedSubtitles = useMemo(() => 
    currentDocument?.translatedSubtitles || [], 
    [currentDocument]
  );

  const originalSubtitles = useMemo(() => 
    currentDocument?.originalSubtitles || [], 
    [currentDocument]
  );

  // Restore session on component mount
  useEffect(() => {
    const savedSession = sessionManager.loadSession();
    if (savedSession) {
      setDocuments(savedSession.documents);
      setCurrentDocumentId(savedSession.currentDocumentId);
      setMaxTotalChars(savedSession.maxTotalChars);
      setMaxLineChars(savedSession.maxLineChars);
      setMinDurationSeconds(savedSession.minDurationSeconds);
      setMaxDurationSeconds(savedSession.maxDurationSeconds);
      setSessionRestored(true);
      
      const sessionAge = sessionManager.getSessionAge();
      console.log(`📂 Session restored! Last saved ${sessionAge} minutes ago.`);
    }
  }, []);

  // Auto-save session when documents change
  useEffect(() => {
    if (sessionRestored || documents.length > 0) {
      const sessionData: SessionData = {
        documents,
        currentDocumentId,
        maxTotalChars,
        maxLineChars,
        minDurationSeconds,
        maxDurationSeconds
      };
      sessionManager.saveSession(sessionData);
    }
  }, [documents, currentDocumentId, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds, sessionRestored]);

  // Clear "recently edited" status when filters change
  useEffect(() => {
    if (currentDocument) {
      setDocuments(prev => prev.map(doc => 
        doc.id === currentDocumentId 
          ? {
              ...doc,
              translatedSubtitles: doc.translatedSubtitles.map(sub => ({
                ...sub,
                recentlyEdited: false,
                editedAt: undefined
              }))
            }
          : doc
      ));
    }
  }, [showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, currentDocumentId]);

  // Recalculate subtitle validation when limits change
  useEffect(() => {
    if (currentDocument) {
      setDocuments(prev => prev.map(doc => 
        doc.id === currentDocumentId 
          ? {
              ...doc,
              translatedSubtitles: doc.translatedSubtitles.map(sub => {
                const charCount = sub.text.replace(/\n/g, '').length;
                const isLong = charCount > maxTotalChars;
                const duration = calculateDuration(sub.startTime, sub.endTime);
                const isTooShort = duration < minDurationSeconds;
                const isTooLong = duration > maxDurationSeconds;
                const hasConflict = hasTimecodeConflict(sub, doc.translatedSubtitles);
                return {
                  ...sub,
                  charCount,
                  isLong,
                  duration,
                  isTooShort,
                  isTooLong,
                  hasTimecodeConflict: hasConflict
                };
              })
            }
          : doc
      ));
    }
  }, [maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds, currentDocumentId]);

  const generateDocumentId = () => {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleFileUpload = (content: string, type: 'original' | 'translated', name: string) => {
    const subs = parseSrt(content);
    const documentId = generateDocumentId();
    
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

    const newDocument: Document = {
      id: documentId,
      name: name,
      translatedSubtitles: type === 'translated' ? processedSubs : [],
      originalSubtitles: type === 'original' ? processedSubs : [],
      lastModified: Date.now()
    };

    setDocuments(prev => [...prev, newDocument]);
    setCurrentDocumentId(documentId);
    setPreviousSubtitles(null); // Clear undo history on new file upload
  };

  const handleSelectDocument = (documentId: string) => {
    setCurrentDocumentId(documentId);
    setPreviousSubtitles(null); // Clear undo when switching documents
  };

  const handleCloseDocument = (documentId: string) => {
    setDocuments(prev => {
      const newDocs = prev.filter(doc => doc.id !== documentId);
      if (currentDocumentId === documentId) {
        setCurrentDocumentId(newDocs.length > 0 ? newDocs[0].id : null);
      }
      return newDocs;
    });
  };

  const handleNewDocument = () => {
    // This will be handled by the file upload component
  };

  const updateCurrentDocument = (updater: (doc: Document) => Document) => {
    if (!currentDocument) return;
    
    setDocuments(prev => prev.map(doc => 
      doc.id === currentDocumentId 
        ? { ...updater(doc), lastModified: Date.now() }
        : doc
    ));
  };

  const handleUpdateTimecode = useCallback((id: number, newStartTime: string, newEndTime: string) => {
    if (!currentDocument) return;

    updateCurrentDocument(doc => ({
      ...doc,
      translatedSubtitles: doc.translatedSubtitles.map(sub => {
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
            editedAt: Date.now(),
            canUndo: true
          };
          
          // Check for conflicts with updated timecodes
          const hasConflict = hasTimecodeConflict(updatedSub, doc.translatedSubtitles.map(s => 
            s.id === id ? updatedSub : s
          ));
          
          return {
            ...updatedSub,
            hasTimecodeConflict: hasConflict
          };
        }
        return sub;
      })
    }));
  }, [currentDocument, minDurationSeconds, maxDurationSeconds]);

  const handleUpdateSubtitle = useCallback((id: number, newText: string) => {
    if (!currentDocument) return;

    updateCurrentDocument(doc => ({
      ...doc,
      translatedSubtitles: doc.translatedSubtitles.map(sub => sub.id === id ? { 
        ...sub, 
        previousText: sub.text, // Store previous text for undo
        text: newText.replace(/<br\s*\/?>/gi, '\n'), 
        charCount: newText.replace(/\n/g, '').length, 
        isLong: newText.replace(/\n/g, '').length > maxTotalChars,
        duration: calculateDuration(sub.startTime, sub.endTime),
        isTooShort: calculateDuration(sub.startTime, sub.endTime) < minDurationSeconds,
        isTooLong: calculateDuration(sub.startTime, sub.endTime) > maxDurationSeconds,
        recentlyEdited: true,
        editedAt: Date.now(),
        canUndo: true
      } : sub)
    }));
    setPreviousSubtitles(null); // Manual edit clears global undo
  }, [currentDocument, maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleDownload = () => {
    if (!currentDocument || currentDocument.translatedSubtitles.length === 0) return;
    
    const srtContent = formatSrt(currentDocument.translatedSubtitles);
    // Add UTF-8 BOM for better compatibility with subtitle players
    const contentWithBOM = '\uFEFF' + srtContent;
    const blob = new Blob([contentWithBOM], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited_${currentDocument.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (documents.length === 0) return;

    const zip = new JSZip();
    
    documents.forEach(doc => {
      if (doc.translatedSubtitles.length > 0) {
        const srtContent = formatSrt(doc.translatedSubtitles);
        const contentWithBOM = '\uFEFF' + srtContent;
        zip.file(`edited_${doc.name}`, contentWithBOM);
      }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited_subtitles.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSplitFilteredLines = useCallback(() => {
    if (!currentDocument) return;

    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    updateCurrentDocument(doc => ({
      ...doc,
      translatedSubtitles: doc.translatedSubtitles.map(sub => {
        // Only process subtitles that are currently visible in filtered view
        const isInFilteredView = filteredSubtitles.some(filteredSub => filteredSub.id === sub.id);
        
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
          const hasConflict = hasTimecodeConflict({...sub, text: newText}, doc.translatedSubtitles.map(s => 
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
      })
    }));
  }, [currentDocument, translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleUndo = () => {
    if (previousSubtitles && currentDocument) {
      updateCurrentDocument(doc => ({
        ...doc,
        translatedSubtitles: previousSubtitles
      }));
      setPreviousSubtitles(null);
    }
  };

  const handleClearSession = () => {
    if (confirm('Are you sure you want to start fresh? This will clear all current work.')) {
      sessionManager.clearSession();
      setDocuments([]);
      setCurrentDocumentId(null);
      setPreviousSubtitles(null);
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
    if (!currentDocument) return;

    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    updateCurrentDocument(doc => ({
      ...doc,
      translatedSubtitles: doc.translatedSubtitles.map(sub => {
        // Only process subtitles that are currently visible in filtered view
        const isInFilteredView = filteredSubtitles.some(filteredSub => filteredSub.id === sub.id);
        
        if (isInFilteredView && sub.text.includes('\n')) {
          const singleLineText = sub.text.replace(/\n/g, ' ');
          const charCount = singleLineText.length;
          const isLong = charCount > maxTotalChars;
          const duration = calculateDuration(sub.startTime, sub.endTime);
          const isTooShort = duration < minDurationSeconds;
          const isTooLong = duration > maxDurationSeconds;
          const hasConflict = hasTimecodeConflict({...sub, text: singleLineText}, doc.translatedSubtitles.map(s => 
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
      })
    }));
  }, [currentDocument, translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleUndoSubtitle = useCallback((id: number) => {
    if (!currentDocument) return;

    updateCurrentDocument(doc => ({
      ...doc,
      translatedSubtitles: doc.translatedSubtitles.map(sub => {
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
      })
    }));
  }, [currentDocument, maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleSplitSubtitle = useCallback((id: number) => {
    if (!currentDocument) return;

    updateCurrentDocument(doc => {
      const subtitleIndex = doc.translatedSubtitles.findIndex(sub => sub.id === id);
      if (subtitleIndex === -1) return doc;
      
      const subtitle = doc.translatedSubtitles[subtitleIndex];
      const splitResult = splitTextIntelligently(subtitle.text);
      
      if (!splitResult.secondPart) {
        console.log('❌ Cannot split subtitle - insufficient content');
        return doc;
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
        ...doc.translatedSubtitles.slice(0, subtitleIndex),
        firstSubtitle,
        secondSubtitle,
        ...doc.translatedSubtitles.slice(subtitleIndex + 1)
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
      
      return {
        ...doc,
        translatedSubtitles: renumberedSubtitles
      };
    });
    
    // Clear global undo since structure changed
    setPreviousSubtitles(null);
  }, [currentDocument, maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleMergeSubtitleWithNext = useCallback((id: number) => {
    if (!currentDocument) return;

    updateCurrentDocument(doc => {
      const index = doc.translatedSubtitles.findIndex(s => s.id === id);
      if (index === -1 || index === doc.translatedSubtitles.length - 1) return doc; // nothing to merge

      const current = doc.translatedSubtitles[index];
      const next = doc.translatedSubtitles[index + 1];

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
        ...doc.translatedSubtitles.slice(0, index),
        merged,
        ...doc.translatedSubtitles.slice(index + 2)
      ].map((sub, i) => ({ ...sub, id: i + 1 }));

      // Recompute conflicts
      const recomputed = newSubtitles.map(s => ({
        ...s,
        hasTimecodeConflict: hasTimecodeConflict(s, newSubtitles)
      }));

      return {
        ...doc,
        translatedSubtitles: recomputed
      };
    });

    // Structure changed, clear global undo
    setPreviousSubtitles(null);
  }, [currentDocument, maxTotalChars, minDurationSeconds, maxDurationSeconds]);

  const handleBulkSplitFiltered = useCallback(() => {
    if (!currentDocument) return;

    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    updateCurrentDocument(doc => {
      // Find all subtitles that can be split in the filtered view
      const splittableSubtitles = filteredSubtitles.filter(sub => {
        const words = sub.text.replace(/\n/g, ' ').trim().split(' ');
        return words.length >= 2 && sub.text.trim().length > 10;
      });
      
      if (splittableSubtitles.length === 0) {
        console.log('❌ No splittable subtitles found in filtered view');
        return doc;
      }
      
      console.log(`✂️ Bulk splitting ${splittableSubtitles.length} filtered subtitles`);
      
      // Process each splittable subtitle
      let newSubtitles = [...doc.translatedSubtitles];
      
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
      }
      
      // Renumber all IDs to maintain sequence
      const renumberedSubtitles = newSubtitles.map((sub, index) => ({
        ...sub,
        id: index + 1
      }));
      
      console.log(`📋 Bulk split completed - ${splittableSubtitles.length} subtitles split into ${splittableSubtitles.length * 2} segments`);
      console.log(`📋 All split segments marked as 'recently edited' - will remain visible in current filter until manually changed`);
      
      return {
        ...doc,
        translatedSubtitles: renumberedSubtitles
      };
    });
    
    // Clear global undo since structure changed
    setPreviousSubtitles(null);
  }, [currentDocument, translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);

  const handleFixTimecodeConflicts = useCallback(() => {
    if (!currentDocument) return;

    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    updateCurrentDocument(doc => {
      // Find all subtitles with timecode conflicts in the filtered view
      const conflictingSubtitles = filteredSubtitles.filter(sub => sub.hasTimecodeConflict);
      
      if (conflictingSubtitles.length === 0) {
        console.log('❌ No timecode conflicts found in filtered view');
        return doc;
      }
      
      console.log(`🔧 Fixing timecode conflicts for ${conflictingSubtitles.length} filtered subtitles`);
      
      // Process each conflicting subtitle
      let newSubtitles = [...doc.translatedSubtitles];
      
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
      
      return {
        ...doc,
        translatedSubtitles: finalSubtitles
      };
    });
  }, [currentDocument, translatedSubtitles, showErrorsOnly, showLongLinesOnly, showTooShortOnly, showTooLongOnly, showTimecodeConflictsOnly, maxTotalChars, maxLineChars, minDurationSeconds, maxDurationSeconds]);
  
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
        onDownloadAll={handleDownloadAll}
        hasTranslatedSubs={translatedSubtitles.length > 0}
        hasMultipleDocuments={documents.length > 1}
        onUndo={handleUndo}
        canUndo={canUndo}
        onClearSession={handleClearSession}
        maxTotalChars={maxTotalChars}
        maxLineChars={maxLineChars}
        minDurationSeconds={minDurationSeconds}
        maxDurationSeconds={maxDurationSeconds}
      />

      <main className="flex-grow container mx-auto p-4 md:p-8">
        {documents.length === 0 ? (
          <div className="text-center mt-16 max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <p className="text-gray-400 text-lg mb-8">
              Upload your translated .srt files to begin. You can upload multiple files and work on them simultaneously.
              You can also upload original versions for side-by-side comparison.
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
                label="Upload Translated SRT Files" 
                onFileUpload={(c, n) => handleFileUpload(c, 'translated', n)} 
                multiple={true}
              />
              <FileUpload 
                label="Upload Original SRT Files (Optional)" 
                onFileUpload={(c, n) => handleFileUpload(c, 'original', n)} 
                multiple={true}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <DocumentSelector
              documents={documents}
              currentDocumentId={currentDocumentId}
              onSelectDocument={handleSelectDocument}
              onCloseDocument={handleCloseDocument}
              onNewDocument={handleNewDocument}
            />
            
            {currentDocument && (
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
          </div>
        )}
      </main>
    </div>
  );
};

export default App;