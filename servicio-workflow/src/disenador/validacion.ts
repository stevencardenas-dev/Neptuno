import type { Paso, Transicion } from './modelo';

/**
 * HU-061: un flujo solo se publica si está completo. Las reglas son las del backlog
 * —estado inicial, estados finales y pasos aislados— y se devuelven todas juntas: al
 * administrador le sirve más la lista completa que el primer error encontrado.
 */

const nombre = (paso: Paso) => `«${paso.nombre}»`;

/** Pasos que se alcanzan saliendo del inicial siguiendo las transiciones. */
function alcanzables(desde: Paso, transiciones: Transicion[]): Set<string> {
  const visitados = new Set<string>([desde.id]);
  const pendientes = [desde.id];
  while (pendientes.length) {
    const actual = pendientes.pop()!;
    for (const transicion of transiciones) {
      if (transicion.estadoOrigenId !== actual || visitados.has(transicion.estadoDestinoId)) continue;
      visitados.add(transicion.estadoDestinoId);
      pendientes.push(transicion.estadoDestinoId);
    }
  }
  return visitados;
}

export function validarPublicacion(pasos: Paso[], transiciones: Transicion[]): string[] {
  const problemas: string[] = [];
  if (!pasos.length) {
    return ['El flujo no tiene pasos: agrega al menos un paso inicial y uno final.'];
  }

  const iniciales = pasos.filter((paso) => paso.tipo === 'INICIAL');
  const finales = pasos.filter((paso) => paso.tipo === 'FINAL');

  if (!iniciales.length) problemas.push('Falta marcar el paso inicial: el flujo no sabe dónde empieza.');
  if (iniciales.length > 1) problemas.push(`Solo puede haber un paso inicial y hay ${iniciales.length}.`);
  if (!finales.length) problemas.push('Falta marcar al menos un paso final: el flujo no sabe dónde termina.');

  const salidas = new Map<string, number>();
  for (const transicion of transiciones) {
    salidas.set(transicion.estadoOrigenId, (salidas.get(transicion.estadoOrigenId) ?? 0) + 1);
  }

  for (const paso of pasos) {
    if (!salidas.get(paso.id) && paso.tipo !== 'FINAL') {
      problemas.push(`El paso ${nombre(paso)} no tiene ninguna salida: nadie podría continuar el trámite.`);
    }
    if (salidas.get(paso.id) && paso.tipo === 'FINAL') {
      problemas.push(`El paso ${nombre(paso)} está marcado como final y tiene salidas.`);
    }
  }

  // Pasos aislados: los que no se alcanzan desde el inicio quedan fuera del recorrido.
  if (iniciales.length === 1) {
    const alcanzados = alcanzables(iniciales[0]!, transiciones);
    for (const paso of pasos) {
      if (paso.id !== iniciales[0]!.id && !alcanzados.has(paso.id)) {
        problemas.push(`El paso ${nombre(paso)} no se alcanza desde el inicio: quedaría aislado.`);
      }
    }
  }

  return problemas;
}
