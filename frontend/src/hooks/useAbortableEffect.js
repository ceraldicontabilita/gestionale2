/**
 * useAbortableEffect — hook di utility per useEffect che fanno fetch.
 *
 * Incapsula il pattern standard Ceraldi per proteggere dalle race condition
 * su cambi rapidi di filtri (Codex P2 pattern #3.11).
 *
 * Usage:
 *   useAbortableEffect((signal) => {
 *     api.get(url, { signal }).then((r) => {
 *       if (signal.aborted) return;
 *       setData(r.data);
 *     }).catch((e) => {
 *       if (isCanceledError(e)) return;
 *       console.error(e);
 *     });
 *   }, [dep1, dep2]);
 *
 * La callback riceve `signal` come argomento. Ogni volta che le deps cambiano,
 * il vecchio signal viene abortito PRIMA di lanciare la nuova richiesta. Ogni
 * risposta in volo deve controllare `signal.aborted` prima di fare setState.
 */
import { useEffect } from 'react';

/**
 * Verifica se un errore è una cancellation di axios o fetch (non un errore reale).
 */
export function isCanceledError(err) {
  if (!err) return false;
  return (
    err.name === 'CanceledError' ||
    err.name === 'AbortError' ||
    err.code === 'ERR_CANCELED'
  );
}

/**
 * useEffect con AbortController integrato.
 *
 * @param {(signal: AbortSignal) => void | Promise<void> | (() => void)} effect
 *   Effetto; riceve il signal dell'AbortController. Può opzionalmente
 *   ritornare una funzione di cleanup che verrà eseguita DOPO l'abort.
 * @param {React.DependencyList} deps
 */
export function useAbortableEffect(effect, deps) {
  useEffect(() => {
    const controller = new AbortController();
    const cleanup = effect(controller.signal);

    return () => {
      controller.abort();
      // Se l'effect ha ritornato una cleanup custom (non una Promise), eseguila
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
