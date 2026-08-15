import { useAutoSaveContext } from '../provider/AutoSaveProvider'

/**
 * Antes tenía su propio motor de autoguardado (cola + fetch propios), lo que
 * generaba dos colas y peticiones en paralelo contra el mismo endpoint.
 *
 * Ahora delega en el motor ÚNICO del AutoSaveProvider vía contexto. Se mantiene
 * como alias por compatibilidad con StepPieceSelection.
 *
 * @param _delay Ignorado; el debounce lo gestiona el motor único del Provider.
 */
export function usePieceAutoSave(_delay: number = 500) {
  const { saveField } = useAutoSaveContext()
  return { saveField }
}
