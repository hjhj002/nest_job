import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { theme as antdTheme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  themeConfig: ThemeConfig;
}

const lightTheme: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#7c3aed',
    colorLink: '#7c3aed',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    borderRadius: 8,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      triggerBg: '#f4f2ff',
      triggerColor: '#7c3aed',
    },
    Menu: {
      itemBg: '#ffffff',
      subMenuItemBg: '#faf8ff',
      itemSelectedBg: '#ede9fe',
      itemSelectedColor: '#7c3aed',
      itemHoverBg: '#f5f3ff',
      itemHoverColor: '#7c3aed',
      itemColor: '#374151',
      itemIconColor: '#6b7280',
      itemSelectedIconColor: '#7c3aed',
      groupTitleColor: '#9ca3af',
      popupBg: '#ffffff',
    },
  },
};

const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#7c3aed',
    colorLink: '#a78bfa',
    colorSuccess: '#059669',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    borderRadius: 8,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#141414',
      triggerBg: '#1f1f1f',
      triggerColor: 'rgba(255,255,255,0.65)',
    },
    Menu: {
      darkItemBg: '#141414',
      darkSubMenuItemBg: '#1a1a1a',
      darkItemSelectedBg: '#7c3aed',
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
      darkItemColor: 'rgba(255,255,255,0.65)',
      darkItemSelectedColor: '#ffffff',
      darkItemHoverColor: 'rgba(255,255,255,0.85)',
      darkPopupBg: '#141414',
    },
  },
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  toggle: () => {},
  themeConfig: lightTheme,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggle = () => setMode(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{
      mode,
      toggle,
      themeConfig: mode === 'light' ? lightTheme : darkTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
