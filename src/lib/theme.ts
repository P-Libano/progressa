/** Tema: segue o sistema por padrão; a escolha em Ajustes fica neste aparelho (localStorage). */
export type ThemeChoice = 'sistema' | 'escuro' | 'claro'

const KEY = 'progressa-tema'
const BAR = { escuro: '#0d0f12', claro: '#f3f4f5' } as const

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'escuro' || v === 'claro' ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function applyTheme(choice = getTheme()) {
  const root = document.documentElement
  if (choice === 'sistema') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice === 'escuro' ? 'dark' : 'light')
  // barra do sistema: as duas metas (uma por esquema) passam a ter a cor escolhida
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('light') ? 'claro' : 'escuro'
    m.content = BAR[choice === 'sistema' ? scheme : choice]
  })
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'sistema') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // sem armazenamento: vale só nesta visita
  }
  applyTheme(choice)
}
