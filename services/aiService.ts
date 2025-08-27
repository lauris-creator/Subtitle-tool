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
  const initialPrompt = `You are a professional subtitle editor. Your task is to reformat the following subtitle text to meet strict subtitle formatting requirements.

FORMATTING RULES (ALL MUST BE FOLLOWED):
1. Maximum ${MAX_TOTAL_CHARS} characters total (including spaces and line breaks)
2. Maximum ${MAX_LINE_CHARS} characters per line (no line can exceed this)
3. Use line breaks (\\n) to split into multiple lines if needed
4. Maintain the exact same meaning as the original
5. Keep original wording as much as possible - only make changes if absolutely necessary to meet the character limits
6. If original wording doesn't fit, you may rephrase while preserving meaning
7. Result must be natural and clear for subtitle display
8. Do not add quotes, explanations, or extra text

PROCESS:
- Look at the entire subtitle as one unit
- Check if it needs to be split across lines
- Ensure each line is ≤${MAX_LINE_CHARS} characters
- Ensure total characters (without \\n) is ≤${MAX_TOTAL_CHARS}

Original subtitle: "${text}"

Provide the properly formatted subtitle:`;

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
      
      const retryPrompt = `The previous formatting attempt failed. Please reformat this subtitle more strictly:

REQUIREMENTS:
- Total characters (excluding line breaks): MAXIMUM ${MAX_TOTAL_CHARS}
- Each line: MAXIMUM ${MAX_LINE_CHARS} characters
- Use \\n for line breaks
- Preserve meaning but prioritize meeting the character limits

Text to reformat: "${formattedText}"

Provide a properly formatted version:`;

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
        
    return formattedText;

  } catch (error) {
    console.error("AI API call failed after retries:", error);
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw new Error("AI_CALL_FAILED");
  }
};
