import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartSyncProvider } from "@/components/CartSyncProvider";
import { listCategorias, listMarcas } from "@/lib/data";

export const revalidate = 300;

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [categorias, marcas] = await Promise.all([
    listCategorias(),
    listMarcas(),
  ]);

  return (
    <CartSyncProvider>
      <Header categorias={categorias} marcas={marcas} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </CartSyncProvider>
  );
}
