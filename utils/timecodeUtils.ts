import { Subtitle } from '../types';

/**
 * Convert SRT timecode to seconds for comparison
 * Format: HH:MM:SS,mmm
 */
export function timecodeToSeconds(timecode: string): number {
  const [time, ms] = timecode.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds + Number(ms) / 1000;
}

/**
 * Convert seconds back to SRT timecode format
 */
export function secondsToTimecode(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Check if two timecode ranges overlap
 */
export function timecodesOverlap(
  start1: string, 
  end1: string, 
  start2: string, 
  end2: string
): boolean {
  const start1Sec = timecodeToSeconds(start1);
  const end1Sec = timecodeToSeconds(end1);
  const start2Sec = timecodeToSeconds(start2);
  const end2Sec = timecodeToSeconds(end2);
  
  // Two ranges overlap if one starts before the other ends
  return start1Sec < end2Sec && start2Sec < end1Sec;
}

/**
 * Check if a subtitle has timecode conflicts with other subtitles
 */
export function hasTimecodeConflict(subtitle: Subtitle, allSubtitles: Subtitle[]): boolean {
  return allSubtitles.some(other => 
    other.id !== subtitle.id && 
    timecodesOverlap(subtitle.startTime, subtitle.endTime, other.startTime, other.endTime)
  );
}

/**
 * Validate timecode format
 */
export function isValidTimecode(timecode: string): boolean {
  const regex = /^\d{2}:\d{2}:\d{2},\d{3}$/;
  return regex.test(timecode);
}

/**
 * Parse timecode input and return formatted timecode
 */
export function parseTimecodeInput(input: string): string {
  // Remove any non-digit characters except colons and commas
  const cleaned = input.replace(/[^\d:,]/g, '');
  
  // If it's just numbers, try to format it
  if (/^\d+$/.test(cleaned)) {
    const num = parseInt(cleaned);
    if (num < 100) {
      // Assume it's seconds
      return secondsToTimecode(num);
    } else if (num < 10000) {
      // Assume it's MMSS
      const minutes = Math.floor(num / 100);
      const seconds = num % 100;
      return secondsToTimecode(minutes * 60 + seconds);
    } else if (num < 1000000) {
      // Assume it's HHMMSS
      const hours = Math.floor(num / 10000);
      const minutes = Math.floor((num % 10000) / 100);
      const seconds = num % 100;
      return secondsToTimecode(hours * 3600 + minutes * 60 + seconds);
    }
  }
  
  // Try to parse as HH:MM:SS or MM:SS
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    // MM:SS format
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    return secondsToTimecode(minutes * 60 + seconds);
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return secondsToTimecode(hours * 3600 + minutes * 60 + seconds);
  }
  
  // If we can't parse it, return the original input
  return input;
}
