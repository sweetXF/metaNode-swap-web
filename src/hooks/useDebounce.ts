import { useState, useEffect, useRef } from 'react';

/**
 * 防抖 Hook
 * @param value 要防抖的值
 * @param delay 防抖延迟(ms)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  return debouncedValue;
}
