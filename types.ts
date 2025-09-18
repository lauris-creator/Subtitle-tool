
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
}

export interface SessionData {
  translatedSubtitles: Subtitle[];
  maxTotalChars: number;
  maxLineChars: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
}
