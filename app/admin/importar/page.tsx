import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportarForm } from "./ImportarForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar planilha" };

export default async function ImportarPage() {
  const sb = await createSupabaseServerClient();
  const { data: ultimosImports } = await sb
    .from("imports")
    .select("id, tipo, arquivo_path, status, linhas_total, linhas_ok, linhas_erro, criado_em")
    .order("criado_em", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Importar produtos</h1>
        <p className="text-sm text-zinc-500">
          Atualiza preço/estoque/dados em massa pelo código do produto. Aceita CSV, XLSX ou PDF (Tabela de Produtos do Delphi).
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">PDF — Tabela de Produtos (Delphi)</h2>
        <p className="text-sm text-zinc-600">
          Carregue o PDF gerado em <em>Cadastro → Produtos → Imprimir</em>. O sistema lê
          <strong> código, descrição, fabricante, saldo (loja), preço de venda </strong> e referência.
          Preço e estoque dos produtos existentes são atualizados pelo <code className="rounded bg-zinc-100 px-1">codigo</code>.
          Se <em>“Criar produtos novos”</em> estiver marcado, novos códigos são inseridos e marcas
          desconhecidas (fabricante) são criadas automaticamente.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">CSV / XLSX — formato esperado</h2>
        <p className="mb-3 text-sm text-zinc-600">
          A primeira linha deve conter os nomes das colunas (case-insensitive).
          Coluna obrigatória: <code className="rounded bg-zinc-100 px-1">codigo</code>.
          Colunas reconhecidas:
        </p>
        <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {[
            ["codigo (obrigatório)", "ex: BOSCH-GSB13RE"],
            ["nome", "obrigatório se for criar novo"],
            ["descricao", "texto livre"],
            ["preco", "ex: 599.90"],
            ["preco_promocional", "ex: 499.90"],
            ["estoque", "inteiro"],
            ["peso_kg", "ex: 1.8"],
            ["marca_slug", "ex: bosch"],
            ["categoria_slug", "ex: furadeiras"],
            ["ativo", "1/0/sim/nao"],
            ["destaque", "1/0/sim/nao"],
          ].map(([k, ex]) => (
            <div key={k} className="flex justify-between gap-2 rounded bg-zinc-50 px-2 py-1">
              <code className="font-mono">{k}</code>
              <span className="text-zinc-500">{ex}</span>
            </div>
          ))}
        </div>
      </section>

      <ImportarForm />

      <section className="rounded-lg border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-5 py-3 font-semibold">
          Importações recentes
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-2">Quando</th>
              <th className="px-5 py-2">Arquivo</th>
              <th className="px-5 py-2">Status</th>
              <th className="px-5 py-2 text-right">Total</th>
              <th className="px-5 py-2 text-right">OK</th>
              <th className="px-5 py-2 text-right">Erros</th>
            </tr>
          </thead>
          <tbody>
            {(ultimosImports ?? []).map((imp) => (
              <tr key={imp.id} className="border-t border-zinc-100">
                <td className="px-5 py-2 text-zinc-500">
                  {new Date(imp.criado_em).toLocaleString("pt-BR")}
                </td>
                <td className="px-5 py-2 font-mono text-xs">{imp.arquivo_path}</td>
                <td className="px-5 py-2">{imp.status}</td>
                <td className="px-5 py-2 text-right">{imp.linhas_total}</td>
                <td className="px-5 py-2 text-right text-green-700">{imp.linhas_ok}</td>
                <td className="px-5 py-2 text-right text-red-700">{imp.linhas_erro}</td>
              </tr>
            ))}
            {(ultimosImports ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  Nenhuma importação ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
