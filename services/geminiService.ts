import { GoogleGenAI } from "@google/genai";
import { MAX_TOTAL_CHARS } from '../constants';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// Debug logging (will be visible in browser console)
console.log('Environment check:', {
  hasAPIKey: !!process.env.API_KEY,
  hasGeminiKey: !!process.env.GEMINI_API_KEY,
  hasViteKey: !!process.env.VITE_GEMINI_API_KEY,
  finalKeyExists: !!API_KEY,
  keyLength: API_KEY ? API_KEY.length : 0
});

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper function with exponential backoff to handle rate limiting.
const makeApiCall = async (prompt: string, retries = 3, delay = 2000): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 100,
        thinkingConfig: { thinkingBudget: 50 },
      }
    });
    return response.text;
  } catch (error) {
    // Check if it's a rate limit error and we have retries left
    if (retries > 0 && error instanceof Error && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        console.warn(`Rate limit hit. Retrying in ${delay / 1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Retry with one less attempt and double the delay
        return makeApiCall(prompt, retries - 1, delay * 2);
    }
    // If it's another error or retries are exhausted, re-throw it to be handled by the caller.
    throw error;
  }
};


export const getShortenedSubtitle = async (text: string): Promise<string> => {
  const initialPrompt = `You are a professional subtitle editor. Your task is to revise the following subtitle text to be under ${MAX_TOTAL_CHARS} characters.

The revision must follow these rules strictly:
1. Retain the exact same meaning as the original.
2. Keep the wording as close to the original as possible. Make only minimal, necessary changes to meet the character limit.
3. The result must be natural and clear for a subtitle.
4. CRITICAL: The final output's character count MUST be less than ${MAX_TOTAL_CHARS}. This is the most important rule.

Do not add any extra text, explanations, or quotes. Only provide the revised subtitle text.

Original text: "${text}"`;

  try {
    const initialResponse = await makeApiCall(initialPrompt);
    
    if (!initialResponse) {
        console.error("Gemini API response was empty or blocked.");
        return "Suggestion unavailable (blocked or empty).";
    }

    let shortenedText = initialResponse.trim().replace(/"/g, '');

    // If the first attempt is still too long, try a second, more forceful attempt.
    if (shortenedText.length > MAX_TOTAL_CHARS) {
      console.warn(`Initial suggestion was too long (${shortenedText.length} chars). Retrying with a more forceful prompt...`);
      
      const retryPrompt = `The following subtitle is too long. Shorten it to be under ${MAX_TOTAL_CHARS} characters. This is a strict limit. Retain the original meaning. Do not add any extra commentary.

Text to shorten: "${shortenedText}"`;

      const refinedResponse = await makeApiCall(retryPrompt);

      if (refinedResponse) {
        shortenedText = refinedResponse.trim().replace(/"/g, '');
        if (shortenedText.length > MAX_TOTAL_CHARS) {
          console.warn(`Suggestion is STILL too long after retry (${shortenedText.length} chars). The user will need to edit manually.`);
        }
      } else {
        console.error("Gemini API response on retry was empty or blocked. Returning the oversized first suggestion.");
      }
    }
        
    return shortenedText;

  } catch (error) {
    console.error("Gemini API call failed after retries:", error);
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw new Error("API_CALL_FAILED");
  }
};