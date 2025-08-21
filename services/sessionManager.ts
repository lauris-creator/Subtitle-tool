import { Subtitle } from '../types';

const SESSION_KEY = 'srt-editor-session';

export interface SessionData {
  originalSubtitles: Subtitle[];
  translatedSubtitles: Subtitle[];
  fileName: string;
  timestamp: number;
}

export const sessionManager = {
  // Save current session to localStorage
  saveSession: (data: Omit<SessionData, 'timestamp'>) => {
    try {
      const sessionData: SessionData = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.warn('Failed to save session:', error);
    }
  },

  // Load session from localStorage
  loadSession: (): SessionData | null => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      
      const data = JSON.parse(stored) as SessionData;
      
      // Check if session is older than 24 hours (optional expiry)
      const oneDay = 24 * 60 * 60 * 1000;
      if (Date.now() - data.timestamp > oneDay) {
        sessionManager.clearSession();
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn('Failed to load session:', error);
      return null;
    }
  },

  // Clear session from localStorage
  clearSession: () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  },

  // Check if there's a saved session
  hasSession: (): boolean => {
    return sessionManager.loadSession() !== null;
  },

  // Get session age in minutes
  getSessionAge: (): number | null => {
    const session = sessionManager.loadSession();
    if (!session) return null;
    return Math.floor((Date.now() - session.timestamp) / 1000 / 60);
  }
};
