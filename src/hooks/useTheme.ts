/**
 * 主题切换
 *
 * 三件事：
 * 1. 初值优先读 DOM 上已有的 data-theme（index.html 里的内联脚本已提前写好，避免首屏闪白）
 * 2. 用户显式切换后写入 localStorage，之后不再跟随系统
 * 3. 没被显式切换过时，跟随系统的 prefers-color-scheme 变化
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dbmagnifier.theme';

function readDomTheme(): Theme | null {
  const value = document.documentElement.dataset.theme;
  return value === 'dark' || value === 'light' ? value : null;
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null; // 隐私模式下 localStorage 可能直接抛错
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface UseThemeResult {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme() ?? readDomTheme() ?? systemTheme(),
  );

  // 同步到 <html data-theme>，CSS 只靠这个属性换肤
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    /*
     * theme-color 决定移动端浏览器地址栏/状态栏的颜色。
     * 取值必须和 styles.css 里的 --canvas 一致：
     * 亮色 #f4f6f9、暗色 #0c0f18。
     * 原来写的是 #111524 / #080a11 —— 那是**顶栏**的底色（深色面板），
     * 拿它当页面底色，在暗色主题下地址栏会比页面浅一档，边界上出现一条突兀的色带。
     */
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0c0f18' : '#f4f6f9');
  }, [theme]);

  // 用户没手动选过时，跟随系统
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (readStoredTheme()) return;
      setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存不进去也不影响本次会话
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return { theme, toggle, setTheme };
}
