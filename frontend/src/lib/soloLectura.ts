import { createContext, useContext } from 'react';

// true cuando el usuario ve una finca que le compartieron en solo lectura (miRol
// LECTOR). Los componentes de edición lo consultan para esconder sus controles;
// el backend igual rechaza cualquier escritura de un lector.
export const SoloLecturaContext = createContext(false);

export function useSoloLectura(): boolean {
  return useContext(SoloLecturaContext);
}
