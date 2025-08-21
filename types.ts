
export interface Subtitle {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  originalText?: string;
  charCount: number;
  isLong: boolean;
  suggestion?: string;
  suggestionLoading?: boolean;
}
