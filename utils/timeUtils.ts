// Utility functions for time calculations and formatting

export function parseTimeToSeconds(timeString: string): number {
  // Parse SRT time format: "00:01:23,456" -> seconds
  const [time, milliseconds] = timeString.split(',');
  const [hours, minutes, seconds] = time.split(':').map(Number);
  
  return hours * 3600 + minutes * 60 + seconds + (Number(milliseconds) || 0) / 1000;
}

export function formatSecondsToTime(totalSeconds: number): string {
  // Convert seconds back to SRT time format: "00:01:23,456"
  const totalMs = Math.round(totalSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

export function calculateDuration(startTime: string, endTime: string): number {
  // Calculate duration in seconds between start and end time
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  return endSeconds - startSeconds;
}

export function formatDuration(seconds: number): string {
  // Format duration for display: "4.5s" or "1m 23s"
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }
}

export function splitTimeProportionally(
  startTime: string, 
  endTime: string, 
  firstPartRatio: number
): { firstEnd: string; secondStart: string } {
  // Split a time range proportionally
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  const totalDuration = endSeconds - startSeconds;
  
  const splitPoint = startSeconds + (totalDuration * firstPartRatio);
  
  return {
    firstEnd: formatSecondsToTime(splitPoint),
    secondStart: formatSecondsToTime(splitPoint)
  };
}
