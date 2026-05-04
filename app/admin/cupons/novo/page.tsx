import Link from "next/link";
import { CupomForm } from "../CupomForm";
import { criarCupomAction } from "../actions";

export default function NovoCupomPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/cupons" className="text-sm text-zinc-500 hover:text-brand-600">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Novo cupom</h1>
      </div>
      <CupomForm onSave={criarCupomAction} />
    </div>
  );
}
