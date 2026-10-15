/**
 * Promessas sem base que o app nunca deve fazer. Usado nos textos gerados
 * ("por que este treino", avisos) e varrido sobre o código nos testes.
 */
export const UNFOUNDED_CLAIMS: { id: string; re: RegExp }[] = [
  { id: 'gordura_localizada', re: /(queima|perder|eliminar|reduzir)\w*\s+(de\s+)?gordura\s+localizada/i },
  { id: 'acelera_metabolismo', re: /acelera\w*\s+(o\s+)?(seu\s+)?metabolismo(?!["”])/i },
  { id: 'metabolismo_percentual', re: /metabolismo\s+(em\s+)?\d+\s*%/i },
  { id: 'emagrecer_rapido', re: /emagre\w*\s+r[aá]pid/i },
  { id: 'calorias_garantidas', re: /queim\w*\s+\d+\s*(k?cal|calorias)/i },
  { id: 'resultado_garantido', re: /(resultado|ganho)s?\s+garantid/i },
  { id: 'derreter_gordura', re: /derret\w*\s+(a\s+)?gordura/i },
  { id: 'tonificar', re: /tonifica\w*\s+(e\s+)?(secar|definir)\s+r[aá]pido/i },
]

/**
 * Devolve os ids das promessas sem base encontradas no texto. Trechos entre aspas são
 * ignorados: são citação (ex.: "não existe atalho que 'acelere o metabolismo'"), não promessa.
 */
export function findUnfoundedClaims(text: string): string[] {
  const unquoted = text.replace(/["“][^"”]*["”]/g, '')
  return UNFOUNDED_CLAIMS.filter((c) => c.re.test(unquoted)).map((c) => c.id)
}
