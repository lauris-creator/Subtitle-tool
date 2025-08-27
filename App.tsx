import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Subtitle } from './types';
import { parseSrt, formatSrt } from './services/srtParser';
import { getShortenedSubtitle } from './services/aiService';
import { sessionManager } from './services/sessionManager';
import { splitTextIntelligently } from './utils/textUtils';
import { splitTimeProportionally } from './utils/timeUtils';
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
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

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
          previousText: sub.text, // Store previous text for undo
          text: line, 
          charCount, 
          isLong,
          recentlyEdited: true,
          editedAt: now,
          canUndo: true
        } : sub)
    });
    setPreviousSubtitles(null); // Manual edit clears global undo
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

  const handleUndoSubtitle = useCallback((id: number) => {
    setTranslatedSubtitles(prev => prev.map(sub => {
      if (sub.id === id && sub.previousText) {
        const charCount = sub.previousText.replace(/\n/g, '').length;
        const isLong = charCount > MAX_TOTAL_CHARS;
        return {
          ...sub,
          text: sub.previousText,
          charCount,
          isLong,
          previousText: undefined,
          canUndo: false,
          recentlyEdited: false
        };
      }
      return sub;
    }));
  }, []);

  const handleGenerateAllSuggestions = useCallback(async () => {
    const problematicSubs = translatedSubtitles.filter(sub => 
      sub.isLong || sub.text.split('\n').some(line => line.length > MAX_LINE_CHARS)
    );
    
    if (problematicSubs.length === 0) return;
    
    setIsGeneratingAll(true);
    setBulkProgress({ current: 0, total: problematicSubs.length });
    
    console.log(`🚀 Starting bulk generation for ${problematicSubs.length} problematic subtitles...`);
    
    // Generate suggestions for all problematic subtitles sequentially to avoid rate limits
    for (let i = 0; i < problematicSubs.length; i++) {
      const sub = problematicSubs[i];
      const currentIndex = i + 1;
      
      try {
        // Update progress and set loading state
        setBulkProgress({ current: currentIndex, total: problematicSubs.length });
        setTranslatedSubtitles(prev => prev.map(s => 
          s.id === sub.id ? { ...s, suggestionLoading: true } : s
        ));
        
        console.log(`📝 Processing subtitle ${currentIndex}/${problematicSubs.length} (ID: ${sub.id})`);
        
        const suggestion = await getShortenedSubtitle(sub.text);
        
        setTranslatedSubtitles(prev => prev.map(s => 
          s.id === sub.id ? { ...s, suggestion, suggestionLoading: false } : s
        ));
        
        console.log(`✅ Completed subtitle ${currentIndex}/${problematicSubs.length}`);
        
        // Small delay to prevent rate limiting (except for the last item)
        if (i < problematicSubs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ Error generating suggestion for subtitle ${sub.id}:`, error);
        const errorMessage = error instanceof Error && error.message === 'RATE_LIMIT_EXCEEDED'
          ? "Rate limit exceeded."
          : "Error fetching suggestion.";
        
        setTranslatedSubtitles(prev => prev.map(s => 
          s.id === sub.id ? { ...s, suggestion: errorMessage, suggestionLoading: false } : s
        ));
      }
    }
    
    setIsGeneratingAll(false);
    setBulkProgress(null);
    console.log(`🎉 Bulk generation completed! Generated suggestions for ${problematicSubs.length} subtitles`);
  }, [translatedSubtitles]);

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
        isLong: splitResult.firstPart.replace(/\n/g, '').length > MAX_TOTAL_CHARS,
        suggestion: undefined, // Clear suggestions for new segments
        suggestionLoading: false,
        recentlyEdited: false,
        canUndo: false,
        previousText: undefined
      };
      
      const secondSubtitle: Subtitle = {
        ...subtitle,
        id: subtitle.id + 1, // Will be renumbered properly below
        text: splitResult.secondPart,
        startTime: timeResult.secondStart,
        charCount: splitResult.secondPart.replace(/\n/g, '').length,
        isLong: splitResult.secondPart.replace(/\n/g, '').length > MAX_TOTAL_CHARS,
        suggestion: undefined, // Clear suggestions for new segments
        suggestionLoading: false,
        recentlyEdited: false,
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
        isLong: splitResult.firstPart.replace(/\n/g, '').length > MAX_TOTAL_CHARS
      };
      
      const secondSubtitle: Subtitle = {
        ...subtitle,
        id: subtitle.id + 1,
        text: splitResult.secondPart,
        startTime: timeResult.secondStart,
        charCount: splitResult.secondPart.replace(/\n/g, '').length,
        isLong: splitResult.secondPart.replace(/\n/g, '').length > MAX_TOTAL_CHARS
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
  }, []);
  
  const hasTotalLengthErrors = useMemo(() => translatedSubtitles.some(sub => sub.isLong), [translatedSubtitles]);
  
  const hasLongLines = useMemo(() => 
    translatedSubtitles.some(sub => 
      sub.text.split('\n').some(line => line.length > MAX_LINE_CHARS)
    ), [translatedSubtitles]);

  const hasProblematicSubs = useMemo(() => 
    translatedSubtitles.some(sub => 
      sub.isLong || sub.text.split('\n').some(line => line.length > MAX_LINE_CHARS)
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
        onGenerateAllSuggestions={handleGenerateAllSuggestions}
        hasProblematicSubs={hasProblematicSubs}
        isGeneratingAll={isGeneratingAll}
        bulkProgress={bulkProgress}
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
            onUndoSubtitle={handleUndoSubtitle}
            onSplitSubtitle={handleSplitSubtitle}
          />
        )}
      </main>
    </div>
  );
};

export default App;