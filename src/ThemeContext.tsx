import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDarkMode: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textMuted: string;
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

// Snowflake Brand Colors
// Primary: Snowflake Blue #29B5E8, Mid Blue #11567F, Midnight #000000
// Secondary: Star Blue #71D3DC, Valencia Orange #FF9F36, Purple Moon #7D44CF
// Tertiary: Iceberg #003545, Winter #24323D

const lightColors = {
  background: '#f8fafc',
  surface: 'white',
  text: '#000000',
  textSecondary: '#24323D',
  textMuted: '#8A999E',
  border: '#e2e8f0',
  primary: '#29B5E8',        // Snowflake Blue
  primaryHover: '#11567F',   // Mid Blue
  primaryText: 'white',
  cardBg: 'white',
  inputBg: 'white',
  inputBorder: '#cbd5e1',
  success: '#10b981',
  error: '#ef4444',
  warning: '#FF9F36',        // Valencia Orange
  accent: '#71D3DC'          // Star Blue
};

const darkColors = {
  background: '#003545',     // Iceberg
  surface: '#24323D',        // Winter
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#8A999E',      // Windy City
  border: '#374151',
  primary: '#29B5E8',        // Snowflake Blue
  primaryHover: '#71D3DC',   // Star Blue
  primaryText: 'white',
  cardBg: '#1e2a36',
  inputBg: '#24323D',
  inputBorder: '#4a5568',
  success: '#34d399',
  error: '#f87171',
  warning: '#FF9F36',        // Valencia Orange
  accent: '#71D3DC'          // Star Blue
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
  const isDarkMode = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode, colors }}>
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
