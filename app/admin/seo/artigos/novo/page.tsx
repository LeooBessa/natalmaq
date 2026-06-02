import { createArtigoAction } from "../actions";

// Cria um rascunho vazio e redireciona para o editor [id]. A própria
// createArtigoAction faz o redirect (e o fallback para a listagem em erro).
export const dynamic = "force-dynamic";

export default async function NovoArtigoPage() {
  await createArtigoAction();
  // Inalcançável: createArtigoAction sempre redireciona.
  return null;
}
