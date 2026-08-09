"use client";

import { useEffect, useRef, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
  const initialValueRef = useRef(initialValue);
  const [value, setValue] = useState<T>(initialValue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue) {
        setValue(JSON.parse(storedValue) as T);
      }
    } catch {
      setValue(initialValueRef.current);
    } finally {
      setIsReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the calculator usable if browser storage is unavailable.
    }
  }, [isReady, key, value]);

  return [value, setValue] as const;
}
