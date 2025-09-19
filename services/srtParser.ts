
import { Subtitle } from '../types';
import { MAX_TOTAL_CHARS } from '../constants';
import { calculateDuration } from '../utils/timeUtils';
import { hasTimecodeConflict } from '../utils/timecodeUtils';

export const parseSrt = (srtContent: string, sourceFile?: string): Subtitle[] => {
  const subtitles: Subtitle[] = [];
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);

  blocks.forEach((block, index) => {
    if (block.trim() === '') return;

    const lines = block.split(/\r?\n/);
    const idLine = lines.find(line => /^\d+$/.test(line.trim()));
    const timecodeLine = lines.find(line => line.includes('-->'));
    const textLines = lines.slice(lines.indexOf(timecodeLine || '') + 1);
    
    if (!idLine || !timecodeLine) {
      console.warn('Skipping invalid SRT block:', block);
      return;
    }
    
    const id = parseInt(idLine.trim(), 10);
    const [startTime, endTime] = timecodeLine.split('-->').map(t => t.trim());
    const text = textLines.join('\n');

    const charCount = text.replace(/\n/g, '').length;
    const isLong = charCount > MAX_TOTAL_CHARS;
    const duration = calculateDuration(startTime, endTime);
    const isTooShort = duration < 1; // Default minimum duration
    const isTooLong = duration > 7; // Default maximum duration

    const subtitle: Subtitle = {
      id,
      startTime,
      endTime,
      text,
      charCount,
      isLong,
      duration,
      isTooShort,
      isTooLong,
      hasTimecodeConflict: false, // Will be calculated later when all subtitles are available
      sourceFile // Multi-file support: track which file this subtitle came from
    };

    subtitles.push(subtitle);
  });

  // Calculate conflicts after all subtitles are created
  subtitles.forEach(subtitle => {
    subtitle.hasTimecodeConflict = hasTimecodeConflict(subtitle, subtitles);
  });

  return subtitles;
};

export const formatSrt = (subtitles: Subtitle[]): string => {
  return subtitles
    .map(sub => {
      return `${sub.id}\n${sub.startTime} --> ${sub.endTime}\n${sub.text}`;
    })
    .join('\n\n') + '\n';
};
