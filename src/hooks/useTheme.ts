import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

const THEME_KEY = 'open-datacenter-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
    if (savedTheme) return savedTheme;
    
    // Default to dark mode (as per OPEN brand)
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove both classes first
    root.classList.remove('light', 'dark');
    
    // Add the current theme class
    root.classList.add(theme);
    
    // Save to localStorage
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
}
