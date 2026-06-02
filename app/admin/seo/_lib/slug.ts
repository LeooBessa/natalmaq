// Slug compartilhado das telas de Conteúdo/SEO.
// Idêntico ao slugify() local de app/admin/produtos/actions.ts:
// lowercase → NFD → remove diacríticos → [^a-z0-9]+ vira "-" → trim de "-" → 80 chars.
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
