import { Document, SessionData } from '../types';

const SESSION_KEY = 'srt-editor-session';

export const sessionManager = {
  // Save current session to localStorage
  saveSession: (data: SessionData) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
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
      const oldestDocument = data.documents.reduce((oldest, doc) => 
        Math.max(oldest, doc.lastModified), 0);
      
      if (Date.now() - oldestDocument > oneDay) {
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
    if (!session || session.documents.length === 0) return null;
    
    const oldestDocument = session.documents.reduce((oldest, doc) => 
      Math.max(oldest, doc.lastModified), 0);
    return Math.floor((Date.now() - oldestDocument) / 1000 / 60);
  }
};
