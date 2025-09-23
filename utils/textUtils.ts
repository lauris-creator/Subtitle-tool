// Utility functions for intelligent text splitting

export function splitTextIntelligently(text: string): { 
  firstPart: string; 
  secondPart: string; 
  firstRatio: number; 
} {
  // Remove line breaks and work with a single text block
  const cleanText = text.replace(/\n/g, ' ').trim();
  const words = cleanText.split(' ');
  
  if (words.length === 1) {
    // Can't split a single word, return as-is
    return {
      firstPart: text,
      secondPart: '',
      firstRatio: 1.0
    };
  }
  
  // Find the best split point (closest to 50% character-wise)
  const totalChars = cleanText.length;
  const targetSplit = totalChars / 2;
  
  let bestSplitIndex = 0;
  let bestDistance = Infinity;
  
  for (let i = 1; i < words.length; i++) {
    const firstPartWords = words.slice(0, i);
    const firstPartText = firstPartWords.join(' ');
    const distance = Math.abs(firstPartText.length - targetSplit);
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSplitIndex = i;
    }
  }
  
  // Split the words
  const firstPartWords = words.slice(0, bestSplitIndex);
  const secondPartWords = words.slice(bestSplitIndex);
  
  const firstPart = firstPartWords.join(' ');
  const secondPart = secondPartWords.join(' ');
  
  // Calculate the ratio based on character count (including spaces)
  const firstPartChars = firstPart.length;
  const totalOriginalChars = firstPartChars + secondPart.length;
  const firstRatio = totalOriginalChars > 0 ? firstPartChars / totalOriginalChars : 0.5;
  
  return {
    firstPart,
    secondPart,
    firstRatio
  };
}

export function splitLineIntelligently(line: string, maxLineChars: number): string[] {
  // If line is already short enough, return as-is
  if (line.length <= maxLineChars) {
    return [line];
  }
  
  const words = line.trim().split(' ');
  
  // If only one word, can't split meaningfully
  if (words.length === 1) {
    return [line];
  }
  
  // Find the best split point for 50:50 character distribution
  const totalChars = line.length;
  const targetSplit = totalChars / 2;
  
  let bestSplitIndex = 0;
  let bestDistance = Infinity;
  
  // Try each possible word boundary
  for (let i = 1; i < words.length; i++) {
    const firstPartWords = words.slice(0, i);
    const firstPartText = firstPartWords.join(' ');
    const distance = Math.abs(firstPartText.length - targetSplit);
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSplitIndex = i;
    }
  }
  
  // Split the words
  const firstPartWords = words.slice(0, bestSplitIndex);
  const secondPartWords = words.slice(bestSplitIndex);
  
  const firstPart = firstPartWords.join(' ');
  const secondPart = secondPartWords.join(' ');
  
  // Return both parts if they're both non-empty
  return [firstPart, secondPart].filter(part => part.trim().length > 0);
}

export function validateSplit(text: string): boolean {
  // Check if text can be meaningfully split
  const words = text.replace(/\n/g, ' ').trim().split(' ');
  return words.length >= 2 && text.trim().length > 10; // At least 2 words and 10 characters
}

export function cleanSpaces(text: string): string {
  // Replace multiple consecutive spaces (double, triple, etc.) with single space
  // Also clean up spaces around line breaks
  return text
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .replace(/\s*\n\s*/g, ' ')      // Replace newlines with spaces and clean surrounding spaces
    .trim();                        // Remove leading/trailing whitespace
}

export function hasFormatErrors(text: string): boolean {
  // Remove leading and trailing whitespace for accurate detection
  const trimmedText = text.trim();
  
  if (!trimmedText) return false;
  
  // Check if segment starts with punctuation
  const startsWithPunctuation = /^[.,;:!?\-]/.test(trimmedText);
  
  // Check if segment starts with closing brackets
  const startsWithClosingBracket = /^[\)\]\}\>]/.test(trimmedText);
  
  // Check if segment ends with opening brackets
  const endsWithOpeningBracket = /[\(\[\{\<]$/.test(trimmedText);
  
  return startsWithPunctuation || startsWithClosingBracket || endsWithOpeningBracket;
}
