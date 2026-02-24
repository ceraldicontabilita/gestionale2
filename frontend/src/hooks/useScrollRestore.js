/**
 * Hook per ripristinare la posizione di scroll dopo operazioni asincrone
 * Salva la posizione attuale, esegue l'azione, poi ripristina la posizione
 */
import { useCallback, useRef } from 'react';

export function useScrollRestore() {
  const scrollPositionRef = useRef(0);

  // Salva la posizione corrente
  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.scrollY;
  }, []);

  // Ripristina la posizione dopo un breve delay
  const restoreScrollPosition = useCallback((delay = 100) => {
    setTimeout(() => {
      window.scrollTo({
        top: scrollPositionRef.current,
        behavior: 'instant'
      });
    }, delay);
  }, []);

  // Wrapper per azioni che modificano dati
  const withScrollRestore = useCallback((asyncFn) => {
    return async (...args) => {
      saveScrollPosition();
      const result = await asyncFn(...args);
      restoreScrollPosition();
      return result;
    };
  }, [saveScrollPosition, restoreScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    withScrollRestore
  };
}

export default useScrollRestore;
