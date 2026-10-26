import { useCallback, useEffect, useRef, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';

/** Copy text and expose a short-lived "copied" key (web: navigator.clipboard + setTimeout). */
export function useCopyToClipboard(resetMs = 2000) {
  const [copiedKey, setCopiedKey] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    (text, key = 'default') => {
      if (!text) return;
      Clipboard.setString(String(text));
      setCopiedKey(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedKey(''), resetMs);
    },
    [resetMs]
  );

  return { copy, copiedKey };
}
