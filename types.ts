
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
  recentlyEdited?: boolean;
  editedAt?: number;
  previousText?: string; // For individual undo
  canUndo?: boolean;
}
