
export interface Subtitle {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  originalText?: string;
  charCount: number;
  isLong: boolean;
  duration: number; // Duration in seconds
  isTooShort: boolean; // Under 1 second
  isTooLong: boolean; // Over 7 seconds
  hasTimecodeConflict: boolean; // Overlapping with other segments
  recentlyEdited?: boolean;
  editedAt?: number;
  previousText?: string; // For individual undo
  previousStartTime?: string; // For timecode undo
  previousEndTime?: string; // For timecode undo
  canUndo?: boolean;
  sourceFile?: string; // Multi-file support: which file this subtitle came from
}

export interface SessionData {
  translatedSubtitles: Subtitle[];
  originalSubtitles: Subtitle[];
  fileName: string;
  availableFiles: string[]; // Multi-file support
  maxTotalChars: number;
  maxLineChars: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

export interface User {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}
