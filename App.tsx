import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Subtitle } from './types';
import { parseSrt, formatSrt } from './services/srtParser';
import { getShortenedSubtitle } from './services/aiService';
import { sessionManager } from './services/sessionManager';
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
  const [fileName, setFileName] = useState<string>('');
  const [sessionRestored, setSessionRestored] = useState<boolean>(false);

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
        fileName
      });
    }
  }, [originalSubtitles, translatedSubtitles, fileName, sessionRestored]);

  // Clear "recently edited" status when filters change (not after timeout)
  useEffect(() => {
    // Clear recently edited when user changes filters
    setTranslatedSubtitles(prev => prev.map(sub => ({
      ...sub,
      recentlyEdited: false,
      editedAt: undefined
    })));
  }, [showErrorsOnly, showLongLinesOnly]); // Clear when filters change

  const handleFileUpload = (content: string, type: 'original' | 'translated', name: string) => {
    const subs = parseSrt(content);
    setPreviousSubtitles(null); // Clear undo history on new file upload
    if (type === 'translated') {
      setTranslatedSubtitles(subs);
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

  const handleSuggestion = useCallback(async (id: number) => {
    setTranslatedSubtitles(prev => prev.map(sub => sub.id === id ? { ...sub, suggestionLoading: true } : sub));
    try {
      const subToFix = translatedSubtitles.find(sub => sub.id === id);
      if (subToFix) {
        const suggestion = await getShortenedSubtitle(subToFix.text);
        setTranslatedSubtitles(prev => prev.map(sub => sub.id === id ? { ...sub, suggestion, suggestionLoading: false } : sub));
      }
    } catch (error) {
      console.error("Error getting suggestion:", error);
      const errorMessage = error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED'
        ? "Rate limit exceeded. Please wait a moment."
        : "Error fetching suggestion.";
      setTranslatedSubtitles(prev => prev.map(sub => sub.id === id ? { ...sub, suggestion: errorMessage, suggestionLoading: false } : sub));
    }
  }, [translatedSubtitles]);

  const handleUpdateSubtitle = useCallback((id: number, newText: string) => {
    setTranslatedSubtitles(prev => {
        const line = newText.replace(/<br\s*\/?>/gi, '\n');
        const charCount = line.replace(/\n/g, '').length;
        const isLong = charCount > MAX_TOTAL_CHARS;
        const now = Date.now();
        return prev.map(sub => sub.id === id ? { 
          ...sub, 
          text: line, 
          charCount, 
          isLong,
          recentlyEdited: true,
          editedAt: now
        } : sub)
    });
    setPreviousSubtitles(null); // Manual edit clears undo
  }, []);

  const handleUpdateSuggestion = useCallback((id: number, newSuggestion: string) => {
      setTranslatedSubtitles(prev => prev.map(sub => sub.id === id ? { ...sub, suggestion: newSuggestion } : sub));
  }, []);

  const handleAcceptSuggestion = useCallback((id: number) => {
    const subToUpdate = translatedSubtitles.find(sub => sub.id === id);
    if (subToUpdate && subToUpdate.suggestion) {
      handleUpdateSubtitle(id, subToUpdate.suggestion);
    }
  }, [translatedSubtitles, handleUpdateSubtitle]);

  const handleDownload = () => {
    if (translatedSubtitles.length === 0) return;
    const srtContent = formatSrt(translatedSubtitles);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited_${fileName || 'subtitles.srt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSplitAllLongLines = () => {
    setPreviousSubtitles(translatedSubtitles); // Save state for undo
    const newSubtitles = translatedSubtitles.map(sub => {
      const lines = sub.text.split('\n');
      const needsSplitting = lines.some(line => line.length > MAX_LINE_CHARS);
  
      if (!needsSplitting) {
        return sub;
      }
  
      const newLines = lines.flatMap(line => {
        if (line.length <= MAX_LINE_CHARS) {
          return [line];
        }
        
        let breakPoint = line.substring(0, MAX_LINE_CHARS + 1).lastIndexOf(' ');
        if (breakPoint <= 0) { // No space found or at the beginning
          breakPoint = MAX_LINE_CHARS;
        }
  
        const line1 = line.substring(0, breakPoint).trim();
        const line2 = line.substring(breakPoint).trim();
        
        // This simple split could still result in line2 being too long, but it handles the most common cases.
        return [line1, line2].filter(l => l);
      });
  
      const newText = newLines.join('\n');
      const newCharCount = newText.replace(/\n/g, '').length;
      
      return {
        ...sub,
        text: newText,
        charCount: newCharCount,
        isLong: newCharCount > MAX_TOTAL_CHARS,
      };
    });
    setTranslatedSubtitles(newSubtitles);
  };

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
  
  const hasTotalLengthErrors = useMemo(() => translatedSubtitles.some(sub => sub.isLong), [translatedSubtitles]);
  
  const hasLongLines = useMemo(() => 
    translatedSubtitles.some(sub => 
      sub.text.split('\n').some(line => line.length > MAX_LINE_CHARS)
    ), [translatedSubtitles]);

  const filteredSubtitles = useMemo(() => {
    const hasActiveFilter = showErrorsOnly || showLongLinesOnly;

    if (!hasActiveFilter) {
      return translatedSubtitles;
    }

    return translatedSubtitles.filter(sub => {
      const lineLengthExceeded = sub.text.split('\n').some(line => line.length > MAX_LINE_CHARS);
      
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
      return false; 
    });
  }, [translatedSubtitles, showErrorsOnly, showLongLinesOnly]);

  const canUndo = previousSubtitles !== null;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      <Header 
        onDownload={handleDownload}
        hasTranslatedSubs={translatedSubtitles.length > 0}
        onSplitAll={handleSplitAllLongLines}
        hasLongLines={hasLongLines}
        onUndo={handleUndo}
        canUndo={canUndo}
        onClearSession={handleClearSession}
      />

      <main className="flex-grow container mx-auto p-4 md:p-8">
        {translatedSubtitles.length === 0 ? (
          <div className="text-center mt-16 max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <p className="text-gray-400 text-lg mb-8">
              Upload your translated .srt file to begin. You can also upload an original version for side-by-side comparison.
              The app will automatically flag lines longer than 74 characters and help you fix them with AI.
            </p>
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
            onSuggestion={handleSuggestion}
            onUpdateSubtitle={handleUpdateSubtitle}
            onUpdateSuggestion={handleUpdateSuggestion}
            onAcceptSuggestion={handleAcceptSuggestion}
          />
        )}
      </main>
    </div>
  );
};

export default App;