import { AplicarFotoManager } from "./AplicarFotoManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aplicar foto em lote" };

export default function AplicarFotoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Aplicar foto em vários produtos</h1>
        <p className="text-sm text-zinc-500">
          Envie uma foto uma vez e adicione-a a quantos produtos quiser de uma
          só vez. Útil para produtos parecidos que usam a mesma imagem.
        </p>
      </div>
      <AplicarFotoManager />
    </div>
  );
}
