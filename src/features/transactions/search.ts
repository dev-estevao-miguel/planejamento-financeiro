/** "Farmácia 50%" -> "farmacia 50\%": same normalization as search_text, with LIKE wildcards escaped. */
export function searchPattern(search: string): string {
  const normalized = search
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${normalized}%`;
}
