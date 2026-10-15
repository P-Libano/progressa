# Marca: Ferro & Latão

O brand book completo (voz, logo, cores, tipografia, componentes com prévia ao vivo) fica no design system
**Progressa**: https://claude.ai/artifact/A3Eq8d4Kkm2bqqcomkuQfp (privado; compartilhe pelo menu Share).

Resumo do que o código aplica:

| Onde | O quê |
|---|---|
| `src/index.css` | Tokens de cor dos temas Ferro (escuro, padrão) e Giz (claro); fontes; cantos (6/8/12px); utilitários `display` e `eyebrow`; anel de foco |
| `src/assets/fonts/` | Archivo (variável, largura e peso) e Hanken Grotesk (variável), subconjunto latino, licença SIL OFL 1.1 |
| `src/components/Brand.tsx` | `BrandMark` (marca "Carga") e `BrandLockup` (marca + wordmark), em `currentColor` |
| `src/assets/brand/wordmark.svg` | "progressa" em contorno (Archivo 125% de largura, peso 760) |
| `scripts/icons/*.svg` → `public/*.png` | Ícones do PWA: `node scripts/icons/render.mjs` |
| `src/lib/theme.ts` | Tema do sistema ou escolhido em Ajustes → Aparência; atualiza a `theme-color` |

Regras curtas:

- Latão (`accent`) = ação e progresso. Um botão primário por tela.
- Aço (`warn`) = recuar (reduzir, deload, avisos). Vermelho (`danger`) só apaga.
- Títulos e todos os números em Archivo (`display`); texto em Hanken Grotesk.
- Bordas antes de sombras; sombra só no que flutua.
- Português do Brasil, "você", número sempre à vista, sem emoji, sem promessas sem base.
