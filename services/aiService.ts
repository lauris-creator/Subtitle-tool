import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MAX_TOTAL_CHARS } from '../constants';

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
  const initialPrompt = `You are a professional subtitle editor. Your task is to revise the following subtitle text to be under ${MAX_TOTAL_CHARS} characters.

The revision must follow these rules strictly:
1. Retain the exact same meaning as the original.
2. Keep the wording as close to the original as possible. Make only minimal, necessary changes to meet the character limit.
3. The result must be natural and clear for a subtitle.
4. CRITICAL: The final output's character count MUST be less than ${MAX_TOTAL_CHARS}. This is the most important rule.

Do not add any extra text, explanations, or quotes. Only provide the revised subtitle text.

Original text: "${text}"`;

  try {
    const initialResponse = await makeAICall(initialPrompt);
    
    if (!initialResponse) {
      console.error("AI API response was empty or blocked.");
      return "Suggestion unavailable (blocked or empty).";
    }

    let shortenedText = initialResponse.trim().replace(/"/g, '');

    // If the first attempt is still too long, try a second, more forceful attempt.
    if (shortenedText.length > MAX_TOTAL_CHARS) {
      console.warn(`Initial suggestion was too long (${shortenedText.length} chars). Retrying with a more forceful prompt...`);
      
      const retryPrompt = `The following subtitle is too long. Shorten it to be under ${MAX_TOTAL_CHARS} characters. This is a strict limit. Retain the original meaning. Do not add any extra commentary.

Text to shorten: "${shortenedText}"`;

      const refinedResponse = await makeAICall(retryPrompt);

      if (refinedResponse) {
        shortenedText = refinedResponse.trim().replace(/"/g, '');
        if (shortenedText.length > MAX_TOTAL_CHARS) {
          console.warn(`Suggestion is STILL too long after retry (${shortenedText.length} chars). The user will need to edit manually.`);
        }
      } else {
        console.error("AI API response on retry was empty or blocked. Returning the oversized first suggestion.");
      }
    }
        
    return shortenedText;

  } catch (error) {
    console.error("AI API call failed after retries:", error);
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('rate limit'))) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw new Error("AI_CALL_FAILED");
  }
};
