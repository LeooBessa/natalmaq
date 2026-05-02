import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 bg-navy text-white/70">
      <div className="mx-auto max-w-[1280px] px-6 py-12 text-sm">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image
              src="/brand/natalmaq-mark.png"
              alt="Natalmaq"
              width={840}
              height={504}
              className="h-12 w-auto"
            />
            <p className="mt-4 leading-relaxed">
              Av. Industrial Norte, 2.480 — Galpão 04
              <br />
              Distrito Industrial · Natal/RN
              <br />
              CEP 59.115-080 · CNPJ 09.493.387/0001-30
            </p>
          </div>
          <FooterCol
            title="Catálogo"
            items={[
              { label: "Máquinas Elétricas", href: "/catalogo" },
              { label: "Ferramentas Manuais", href: "/catalogo" },
              { label: "EPI e Segurança", href: "/catalogo" },
              { label: "Solda e Corte", href: "/catalogo" },
              { label: "Medição", href: "/catalogo" },
            ]}
          />
          <FooterCol
            title="Empresa"
            items={[
              { label: "Sobre a Natalmaq", href: "/institucional" },
              { label: "Política de troca", href: "/institucional" },
              { label: "Termos de uso", href: "/institucional" },
              { label: "Privacidade", href: "/institucional" },
            ]}
          />
          <FooterCol
            title="Atendimento"
            items={[
              { label: "(84) 3000-0000", href: "/" },
              { label: "WhatsApp comercial", href: "/" },
              { label: "vendas@natalmaq.com.br", href: "/" },
              { label: "Seg–Sex 7h–18h · Sáb 7h–12h", href: "/" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-5 font-mono text-[11px] uppercase tracking-mono md:flex-row">
          <span>© {new Date().getFullYear()} NATALMAQ COMÉRCIO DE FERRAMENTAS LTDA</span>
          <span>SITE ONLINE · ATUALIZADO 02/05/2026</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-white">
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href as never}
              className="transition hover:text-white"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
