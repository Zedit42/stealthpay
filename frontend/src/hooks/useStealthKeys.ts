import { useState, useEffect } from 'react';
import { type StealthKeys, getStoredKeys, generateAndStoreKeys, clearKeys } from '../crypto/stealth';

export function useStealthKeys() {
  const [keys, setKeys] = useState<StealthKeys | null>(null);

  useEffect(() => {
    setKeys(getStoredKeys());
  }, []);

  const generate = () => {
    const newKeys = generateAndStoreKeys();
    setKeys(newKeys);
    return newKeys;
  };

  const clear = () => {
    clearKeys();
    setKeys(null);
  };

  return { keys, generate, clear, hasKeys: !!keys };
}
