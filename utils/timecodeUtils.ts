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

/**
 * Add time to a timecode
 */
export function addTimeToTimecode(timecode: string, secondsToAdd: number): string {
  const currentSeconds = timecodeToSeconds(timecode);
  const newSeconds = Math.max(0, currentSeconds + secondsToAdd);
  return secondsToTimecode(newSeconds);
}

/**
 * Calculate gap between two subtitles
 */
export function calculateGap(subtitle1: Subtitle, subtitle2: Subtitle): number {
  const end1Seconds = timecodeToSeconds(subtitle1.endTime);
  const start2Seconds = timecodeToSeconds(subtitle2.startTime);
  return Math.max(0, start2Seconds - end1Seconds);
}

/**
 * Find the next subtitle after a given index
 */
export function findNextSubtitle(subtitles: Subtitle[], currentIndex: number): Subtitle | null {
  for (let i = currentIndex + 1; i < subtitles.length; i++) {
    if (subtitles[i].id > subtitles[currentIndex].id) {
      return subtitles[i];
    }
  }
  return null;
}

/**
 * Calculate cascade adjustment plan for fixing timecode issues
 */
export interface CascadeStep {
  subtitleId: number;
  action: 'extend' | 'shorten' | 'move';
  timeChange: number;
  reason: string;
}

export interface CascadePlan {
  steps: CascadeStep[];
  totalAffected: number;
  canBeFixed: boolean;
  reason?: string;
}

export function calculateCascadePlan(
  subtitles: Subtitle[], 
  minDurationSeconds: number
): CascadePlan {
  const steps: CascadeStep[] = [];
  const result = [...subtitles];
  
  // First pass: identify all segments that need fixing
  const needsFixing = result.filter(sub => {
    const duration = timecodeToSeconds(sub.endTime) - timecodeToSeconds(sub.startTime);
    return duration < minDurationSeconds;
  });
  
  if (needsFixing.length === 0) {
    return { steps: [], totalAffected: 0, canBeFixed: true };
  }
  
  // Process each segment that needs fixing
  for (const subtitle of needsFixing) {
    const currentIndex = result.findIndex(s => s.id === subtitle.id);
    if (currentIndex === -1) continue;
    
    const currentDuration = timecodeToSeconds(subtitle.endTime) - timecodeToSeconds(subtitle.startTime);
    const needed = minDurationSeconds - currentDuration;
    
    // Try to find a solution for this segment
    const solution = findCascadeSolution(result, currentIndex, needed, minDurationSeconds);
    
    if (solution) {
      steps.push(...solution.steps);
      // Apply the solution to our working copy
      applyCascadeSolution(result, solution);
    } else {
      return {
        steps: [],
        totalAffected: 0,
        canBeFixed: false,
        reason: `Cannot fix segment #${subtitle.id} - insufficient time available`
      };
    }
  }
  
  return {
    steps,
    totalAffected: new Set(steps.map(s => s.subtitleId)).size,
    canBeFixed: true
  };
}

/**
 * Find a cascade solution for a specific segment
 */
function findCascadeSolution(
  subtitles: Subtitle[], 
  currentIndex: number, 
  needed: number, 
  minDurationSeconds: number
): { steps: CascadeStep[] } | null {
  const steps: CascadeStep[] = [];
  let remainingNeeded = needed;
  
  // Try to take time from next segments
  for (let i = currentIndex + 1; i < subtitles.length && remainingNeeded > 0; i++) {
    const nextSubtitle = subtitles[i];
    const nextDuration = timecodeToSeconds(nextSubtitle.endTime) - timecodeToSeconds(nextSubtitle.startTime);
    const available = nextDuration - minDurationSeconds;
    
    if (available > 0) {
      const takeFromNext = Math.min(remainingNeeded, available);
      
      // Add step to extend current segment
      steps.push({
        subtitleId: subtitles[currentIndex].id,
        action: 'extend',
        timeChange: takeFromNext,
        reason: `Extend to meet minimum duration`
      });
      
      // Add step to shorten next segment
      steps.push({
        subtitleId: nextSubtitle.id,
        action: 'shorten',
        timeChange: takeFromNext,
        reason: `Provide time for segment #${subtitles[currentIndex].id}`
      });
      
      remainingNeeded -= takeFromNext;
    }
  }
  
  // If we still need time, try to use gaps
  if (remainingNeeded > 0) {
    for (let i = currentIndex; i < subtitles.length - 1 && remainingNeeded > 0; i++) {
      const current = subtitles[i];
      const next = subtitles[i + 1];
      const gap = calculateGap(current, next);
      
      if (gap > 0) {
        const useFromGap = Math.min(remainingNeeded, gap);
        
        // Add step to extend current segment using gap
        steps.push({
          subtitleId: current.id,
          action: 'extend',
          timeChange: useFromGap,
          reason: `Use gap before segment #${next.id}`
        });
        
        // Add step to move next segment
        steps.push({
          subtitleId: next.id,
          action: 'move',
          timeChange: useFromGap,
          reason: `Move to maintain gap`
        });
        
        remainingNeeded -= useFromGap;
      }
    }
  }
  
  return remainingNeeded <= 0.001 ? { steps } : null; // Allow small floating point errors
}

/**
 * Apply cascade solution to subtitles
 */
function applyCascadeSolution(subtitles: Subtitle[], solution: { steps: CascadeStep[] }): void {
  for (const step of solution.steps) {
    const subtitleIndex = subtitles.findIndex(s => s.id === step.subtitleId);
    if (subtitleIndex === -1) continue;
    
    const subtitle = subtitles[subtitleIndex];
    
    switch (step.action) {
      case 'extend':
        subtitle.endTime = addTimeToTimecode(subtitle.endTime, step.timeChange);
        break;
      case 'shorten':
        subtitle.startTime = addTimeToTimecode(subtitle.startTime, step.timeChange);
        break;
      case 'move':
        const moveTime = step.timeChange;
        subtitle.startTime = addTimeToTimecode(subtitle.startTime, moveTime);
        subtitle.endTime = addTimeToTimecode(subtitle.endTime, moveTime);
        break;
    }
  }
}

/**
 * Apply cascade fix to subtitles
 */
export function applyCascadeFix(
  subtitles: Subtitle[], 
  minDurationSeconds: number
): Subtitle[] {
  const plan = calculateCascadePlan(subtitles, minDurationSeconds);
  
  if (!plan.canBeFixed) {
    throw new Error(plan.reason || 'Cannot apply cascade fix');
  }
  
  const result = [...subtitles];
  
  // Apply all steps
  for (const step of plan.steps) {
    const subtitleIndex = result.findIndex(s => s.id === step.subtitleId);
    if (subtitleIndex === -1) continue;
    
    const subtitle = result[subtitleIndex];
    
    switch (step.action) {
      case 'extend':
        subtitle.endTime = addTimeToTimecode(subtitle.endTime, step.timeChange);
        break;
      case 'shorten':
        subtitle.startTime = addTimeToTimecode(subtitle.startTime, step.timeChange);
        break;
      case 'move':
        const moveTime = step.timeChange;
        subtitle.startTime = addTimeToTimecode(subtitle.startTime, moveTime);
        subtitle.endTime = addTimeToTimecode(subtitle.endTime, moveTime);
        break;
    }
  }
  
  // Recalculate all properties
  return result.map(subtitle => {
    const duration = timecodeToSeconds(subtitle.endTime) - timecodeToSeconds(subtitle.startTime);
    return {
      ...subtitle,
      duration,
      isTooShort: duration < minDurationSeconds,
      isTooLong: duration > 7, // Default max duration
      hasTimecodeConflict: hasTimecodeConflict(subtitle, result),
      recentlyEdited: true,
      editedAt: Date.now(),
      canUndo: true
    };
  });
}
