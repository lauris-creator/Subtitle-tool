import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MAX_TOTAL_CHARS, MAX_LINE_CHARS } from '../constants';

// Environment variables for different AI providers
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// Initialize AI clients
let openai: OpenAI | null = null;
let genAI: GoogleGenerativeAI | null = null;

if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY.trim(),
    dangerouslyAllowBrowser: true // Required for client-side usage
  });
}

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
}

// OpenAI implementation
const callOpenAI = async (prompt: string): Promise<string | null> => {
  if (!openai) throw new Error('OpenAI not initialized');
  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a professional subtitle editor. Your task is to shorten subtitle text while maintaining the exact same meaning and keeping it natural for subtitles."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 100,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || null;
};

// Google Gemini implementation
const callGemini = async (prompt: string): Promise<string | null> => {
  if (!genAI) throw new Error('Gemini not initialized');
  
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

// Main AI call with fallback logic
const makeAICall = async (prompt: string, retries = 3, delay = 2000): Promise<string | null> => {
  const providers = [];
  
  // Prefer OpenAI if available, then fallback to Gemini
  if (openai) providers.push({ name: 'OpenAI', fn: callOpenAI });
  if (genAI) providers.push({ name: 'Gemini', fn: callGemini });
  
  if (providers.length === 0) {
    throw new Error('No AI providers configured. Please set OPENAI_API_KEY or GEMINI_API_KEY');
  }

  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name} API...`);
      const result = await provider.fn(prompt);
      if (result) {
        console.log(`✅ Success with ${provider.name}`);
        return result;
      }
    } catch (error) {
      console.warn(`❌ ${provider.name} failed:`, error);
      
      // If it's a rate limit and we have retries, wait and try the same provider again
      if (retries > 0 && error instanceof Error && 
          (error.message.includes('429') || error.message.includes('rate limit'))) {
        console.warn(`Rate limit hit on ${provider.name}. Retrying in ${delay / 1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return makeAICall(prompt, retries - 1, delay * 2);
      }
      
      // Continue to next provider
      continue;
    }
  }
  
  throw new Error('All AI providers failed');
};

export const getShortenedSubtitle = async (text: string): Promise<string> => {
  const initialPrompt = `You are a professional subtitle editor. Your task is to reformat the following subtitle text to meet STRICT subtitle formatting requirements.

CRITICAL FORMATTING RULES (MUST BE FOLLOWED):
1. MAXIMUM ${MAX_TOTAL_CHARS} characters total (count all characters except line breaks)
2. MAXIMUM ${MAX_LINE_CHARS} characters per line (each line must be ≤37 characters)
3. MAXIMUM 2 lines only - never use more than 2 lines
4. MUST use line breaks (\\n) to split into 2 lines when text is longer than 37 characters
5. Split at natural word boundaries (spaces), never break words
6. Both lines should be roughly equal length when possible
7. PRESERVE THE ORIGINAL LANGUAGE - do not translate to English or any other language
8. If original wording doesn't fit in 2 lines with character limits, REPHRASE in the SAME LANGUAGE
9. Rephrasing is encouraged when needed to meet the strict limits, but KEEP THE SAME LANGUAGE
10. Result must be natural and clear for subtitle display in the original language
11. Do not add quotes, explanations, or extra text

STEP-BY-STEP PROCESS:
1. IDENTIFY the original language of the text
2. Count total characters (without spaces and line breaks)
3. If ≤37 characters: keep as single line in the SAME LANGUAGE
4. If >37 characters: attempt to split into 2 lines at a natural word boundary in the SAME LANGUAGE
5. If splitting doesn't work within limits, REPHRASE in the SAME LANGUAGE to make it shorter
6. Ensure line 1 is ≤37 characters
7. Ensure line 2 is ≤37 characters  
8. Ensure total characters ≤74
9. NEVER exceed 2 lines - rephrase if necessary in the SAME LANGUAGE
10. DOUBLE-CHECK that the output is in the same language as the input

EXAMPLES:
English Input: "This is a very long subtitle that needs to be split properly"
English Output: "This is a very long subtitle\\nthat needs to be split properly"

Swedish Input: "Det här är en mycket lång undertext som behöver delas upp ordentligt"
Swedish Output: "Det här är en mycket lång undertext\\nsom behöver delas upp ordentligt"

Original subtitle: "${text}"

Provide the properly formatted subtitle with line breaks:`;

  try {
    const initialResponse = await makeAICall(initialPrompt);
    
    if (!initialResponse) {
      console.error("AI API response was empty or blocked.");
      return "Suggestion unavailable (blocked or empty).";
    }

    let formattedText = initialResponse.trim().replace(/"/g, '');

    // Validate the AI response meets our requirements
    const lines = formattedText.split('\n');
    const totalChars = formattedText.replace(/\n/g, '').length;
    const longestLine = Math.max(...lines.map(line => line.length));

    if (totalChars > MAX_TOTAL_CHARS || longestLine > MAX_LINE_CHARS) {
      console.warn(`AI suggestion doesn't meet requirements. Total: ${totalChars} chars, Longest line: ${longestLine} chars. Retrying...`);
      
      const retryPrompt = `FAILED ATTEMPT - The previous formatting did not meet requirements. 

CURRENT ISSUES:
- Total chars: ${totalChars}/${MAX_TOTAL_CHARS} (${totalChars > MAX_TOTAL_CHARS ? 'TOO LONG' : 'OK'})
- Longest line: ${longestLine}/${MAX_LINE_CHARS} chars (${longestLine > MAX_LINE_CHARS ? 'TOO LONG' : 'OK'})

STRICT REQUIREMENTS - NO EXCEPTIONS:
- Total characters (excluding \\n): MUST be ≤${MAX_TOTAL_CHARS}
- Each line: MUST be ≤${MAX_LINE_CHARS} characters  
- MAXIMUM 2 lines only - never use more than 2 lines
- PRESERVE THE ORIGINAL LANGUAGE - do not translate to English or any other language
- MUST split long text into 2 lines using \\n in the SAME LANGUAGE
- Split at word boundaries, never break words
- If still too long, REPHRASE aggressively in the SAME LANGUAGE while preserving the core meaning
- Rephrasing is required if original wording cannot fit in 2 lines with character limits
- FINAL OUTPUT MUST BE IN THE SAME LANGUAGE AS THE INPUT

Text to fix: "${formattedText}"

Provide a correctly formatted version that meets ALL requirements:`;

      const refinedResponse = await makeAICall(retryPrompt);

      if (refinedResponse) {
        formattedText = refinedResponse.trim().replace(/"/g, '');
        
        // Final validation
        const finalLines = formattedText.split('\n');
        const finalTotalChars = formattedText.replace(/\n/g, '').length;
        const finalLongestLine = Math.max(...finalLines.map(line => line.length));
        
        if (finalTotalChars > MAX_TOTAL_CHARS || finalLongestLine > MAX_LINE_CHARS) {
          console.warn(`AI still couldn't meet requirements after retry. Manual editing needed.`);
        }
      } else {
        console.error("AI API response on retry was empty or blocked.");
      }
    }

    // Final post-processing: ensure proper line breaking even if AI failed
    let finalLines = formattedText.split('\n');
    const finalTotalChars = formattedText.replace(/\n/g, '').length;
    
    // Enforce maximum 2 lines rule
    if (finalLines.length > 2) {
      console.warn('AI output exceeded 2 lines, truncating to 2 lines');
      finalLines = finalLines.slice(0, 2);
      formattedText = finalLines.join('\n');
    }
    
    // If we still have issues, apply emergency formatting
    if (finalLines.some(line => line.length > MAX_LINE_CHARS) && finalLines.length === 1) {
      // Single line too long - force split at word boundary
      const words = formattedText.split(' ');
      let line1 = '';
      let line2 = '';
      
      for (const word of words) {
        if ((line1 + ' ' + word).trim().length <= MAX_LINE_CHARS) {
          line1 = (line1 + ' ' + word).trim();
        } else {
          line2 = (line2 + ' ' + word).trim();
        }
      }
      
      if (line1 && line2) {
        formattedText = line1 + '\n' + line2;
        console.log('Applied emergency line splitting');
      }
    }
    
    // Final check: ensure we never exceed 2 lines
    const emergencyLines = formattedText.split('\n');
    if (emergencyLines.length > 2) {
      formattedText = emergencyLines.slice(0, 2).join('\n');
      console.log('Enforced 2-line maximum in post-processing');
    }
        
    return formattedText;

  } catch (error) {
    console.error("AI API call failed after retries:", error);
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw new Error("AI_CALL_FAILED");
  }
};
