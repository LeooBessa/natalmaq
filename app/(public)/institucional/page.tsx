import InstitucionalContent from "./InstitucionalContent";
import { listArtigos } from "@/lib/conteudo";
import { listVagasAtivas } from "@/lib/data";

export const metadata = { title: "Sobre a Natalmaq" };

export const revalidate = 60;

export default async function InstitucionalPage() {
  const [artigos, vagas] = await Promise.all([listArtigos(), listVagasAtivas()]);
  return <InstitucionalContent artigos={artigos.slice(0, 6)} vagas={vagas} />;
}
