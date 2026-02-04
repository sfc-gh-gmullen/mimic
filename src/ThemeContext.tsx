import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    primaryText: string;
    cardBg: string;
    inputBg: string;
    inputBorder: string;
    success: string;
    error: string;
    warning: string;
  };
}

const lightColors = {
  background: '#f5f5f5',
  surface: 'white',
  text: '#212529',
  textSecondary: '#6c757d',
  border: '#e9ecef',
  primary: '#667eea',
  primaryText: 'white',
  cardBg: 'white',
  inputBg: 'white',
  inputBorder: '#ced4da',
  success: '#28a745',
  error: '#dc3545',
  warning: '#ffc107'
};

const darkColors = {
  background: '#1a1a2e',
  surface: '#16213e',
  text: '#e9ecef',
  textSecondary: '#adb5bd',
  border: '#2d3748',
  primary: '#667eea',
  primaryText: 'white',
  cardBg: '#1f2937',
  inputBg: '#2d3748',
  inputBorder: '#4a5568',
  success: '#48bb78',
  error: '#fc8181',
  warning: '#f6e05e'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.style.backgroundColor = theme === 'dark' ? darkColors.background : lightColors.background;
    document.body.style.color = theme === 'dark' ? darkColors.text : lightColors.text;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
