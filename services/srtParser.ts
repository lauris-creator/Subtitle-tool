
import { Subtitle } from '../types';
import { MAX_TOTAL_CHARS } from '../constants';

export const parseSrt = (srtContent: string): Subtitle[] => {
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

    subtitles.push({
      id,
      startTime,
      endTime,
      text,
      charCount,
      isLong,
    });
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
