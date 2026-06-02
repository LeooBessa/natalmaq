import InstitucionalContent from "./InstitucionalContent";
import { listArtigos } from "@/lib/conteudo";

export const metadata = { title: "Sobre a Natalmaq" };

export const revalidate = 60;

export default async function InstitucionalPage() {
  const artigos = await listArtigos();
  return <InstitucionalContent artigos={artigos.slice(0, 6)} />;
}
