import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Settings } from '../types';

/** Reflect background stops without replacing unsaved form fields. */
export function useScanningState(setSettings: Dispatch<SetStateAction<Settings | null>>) {
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.settings) {
        const enabled = changes.settings.newValue?.enabled === true;
        setSettings((current) => current ? { ...current, enabled, stickerFilter: changes.settings.newValue?.stickerFilter ?? 'all' } : current);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [setSettings]);
}
