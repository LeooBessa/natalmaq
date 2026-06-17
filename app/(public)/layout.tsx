import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartSyncProvider } from "@/components/CartSyncProvider";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
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
      {/* WhatsApp flutuante — só no mobile (acima das barras fixas).
          No desktop só aparece no institucional, por isso é md:hidden aqui. */}
      <div className="md:hidden">
        <WhatsAppFloat className="bottom-20 right-4" />
      </div>
    </CartSyncProvider>
  );
}
