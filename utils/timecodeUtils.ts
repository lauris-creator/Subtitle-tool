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
  // Use Math.round instead of Math.floor to handle precision issues
  const ms = Math.round((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Add exactly N seconds to a timecode (handles precision issues)
 */
export function addSecondsToTimecode(timecode: string, secondsToAdd: number): string {
  const [time, ms] = timecode.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  const milliseconds = Number(ms);
  
  // Convert to total milliseconds for precise arithmetic
  const totalMs = hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  const newTotalMs = totalMs + (secondsToAdd * 1000);
  
  // Convert back to timecode format
  const newHours = Math.floor(newTotalMs / 3600000);
  const newMinutes = Math.floor((newTotalMs % 3600000) / 60000);
  const newSeconds = Math.floor((newTotalMs % 60000) / 1000);
  const newMs = newTotalMs % 1000;
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')},${newMs.toString().padStart(3, '0')}`;
}

/**
 * Check if two timecode ranges overlap or are consecutive (no gap)
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
  const hasOverlap = start1Sec < end2Sec && start2Sec < end1Sec;
  
  // Also consider consecutive timecodes as conflicts (no gap between subtitles)
  const isConsecutive = (end1Sec === start2Sec) || (end2Sec === start1Sec);
  
  return hasOverlap || isConsecutive;
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
 * Reduce timecode by 1 millisecond
 */
export function reduceTimecodeByOneMs(timecode: string): string {
  const seconds = timecodeToSeconds(timecode);
  const reducedSeconds = Math.max(0, seconds - 0.001); // Reduce by 1ms, but don't go below 0
  return secondsToTimecode(reducedSeconds);
}

/**
 * Parse timecode input and return formatted timecode
 */
export function parseTimecodeInput(input: string): string {
  // If already in correct format, return as-is
  if (isValidTimecode(input)) {
    return input;
  }
  
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
