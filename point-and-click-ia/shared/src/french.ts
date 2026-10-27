/**
 * Petits utilitaires de langue française pour les textes générés hors LLM (mocks).
 * withArticle('Lampe à huile') -> 'la lampe à huile' ; withArticle('Marthe, l’aubergiste') -> inchangé.
 */
const FEMININE = new Set([
  'lampe', 'porte', 'fenêtre', 'cheminée', 'table', 'lune', 'enseigne', 'lanterne', 'caisse', 'étagère',
  'pelouse', 'arche', 'fontaine', 'clé', 'pièce', 'bouteille', 'taverne', 'ruelle', 'cave', 'chapelle', 'rue',
]);
const MASCULINE = new Set(['coffre', 'tableau', 'tonneau', 'mur', 'plancher', 'sol', 'ciel', 'passage', 'escalier', 'banc', 'jardin', 'gros', 'petit', 'vieux', 'quai']);

export function withArticle(name: string, opts: { keepCase?: boolean } = {}): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  // Nom propre (personnage « Marthe, l’aubergiste », « Sœur Agathe ») : pas d'article.
  if (trimmed.includes(',') || /^(Sœur|Frère|Maître|Dame|Sire)\b/.test(trimmed)) return trimmed;
  const first = trimmed.split(/[\s']/)[0].toLowerCase();
  const lowered = opts.keepCase ? trimmed : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  if (/[sx]$/.test(first) && !MASCULINE.has(first)) return `les ${lowered}`;
  if (/^[aeiouyhéèêàâîôû]/i.test(first)) return `l'${lowered}`;
  const fem = FEMININE.has(first) || (!MASCULINE.has(first) && first.endsWith('e'));
  return `${fem ? 'la' : 'le'} ${lowered}`;
}

/** « à » + article contracté : à le -> au, à les -> aux. */
export function toArticle(name: string, opts: { keepCase?: boolean } = {}): string {
  const n = withArticle(name, opts);
  if (n.startsWith('le ')) return `au ${n.slice(3)}`;
  if (n.startsWith('les ')) return `aux ${n.slice(4)}`;
  return `à ${n}`;
}
