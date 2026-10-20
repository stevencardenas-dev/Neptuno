const CLAVE = 'neptuno.tema'

export function temaActual() {
  return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'oscuro' ? '#0f1318' : '#1b4b8f')
  try { localStorage.setItem(CLAVE, tema) } catch { /* modo privado: no se recuerda */ }
}

export function alternarTema() {
  const siguiente = temaActual() === 'oscuro' ? 'claro' : 'oscuro'
  aplicarTema(siguiente)
  return siguiente
}
