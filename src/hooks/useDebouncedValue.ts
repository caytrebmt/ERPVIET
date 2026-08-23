import { useEffect, useState } from 'react';

/**
 * Returns `value` unchanged until it has been stable for `delayMs`.
 * Used to keep keystroke-heavy filters (search box) from firing a request
 * or re-filtering a large list on every character.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
