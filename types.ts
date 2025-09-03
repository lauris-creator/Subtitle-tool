
export interface Subtitle {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  originalText?: string;
  charCount: number;
  isLong: boolean;
  recentlyEdited?: boolean;
  editedAt?: number;
  previousText?: string; // For individual undo
  canUndo?: boolean;
}
