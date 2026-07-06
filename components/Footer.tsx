import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white text-ink-2">
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
              R. Pres. Sarmento, 545 — Alecrim
              <br />
              Natal/RN · CEP 59037-400
              <br />
              CNPJ 09.493.387/0001-30
            </p>
          </div>
          <FooterCol
            title="Catálogo"
            items={[
              { label: "Máquinas Elétricas", href: "/catalogo?categoria=maquinas-eletricas" },
              { label: "Ferramentas Manuais", href: "/catalogo?categoria=ferramentas-manuais" },
              { label: "EPI e Segurança", href: "/catalogo?categoria=epi-seguranca" },
              { label: "Solda e Corte", href: "/catalogo?categoria=solda-corte" },
              { label: "Medição", href: "/catalogo?categoria=medicao" },
            ]}
          />
          <FooterCol
            title="Empresa"
            items={[
              { label: "Sobre a Natalmaq", href: "/institucional" },
              { label: "Artigos", href: "/artigos" },
              { label: "Política de troca", href: "/institucional" },
              { label: "Termos de uso", href: "/institucional" },
              { label: "Privacidade", href: "/institucional" },
            ]}
          />
          <div>
            <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-ink">
              Atendimento
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  href="tel:+558430259789"
                  className="transition hover:text-brand-500"
                >
                  (84) 3025-9789
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/558430259789"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition hover:text-brand-500"
                >
                  WhatsApp comercial
                </a>
              </li>
              <li>
                <a
                  href="mailto:contato@natalmaqferramentas.com.br"
                  className="transition hover:text-brand-500"
                >
                  contato@natalmaqferramentas.com.br
                </a>
              </li>
              <li className="text-ink-2/70">Seg–Sex 7h–18h · Sáb 7h–12h</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-line pt-5 font-mono text-[11px] uppercase tracking-mono md:flex-row">
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
      <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-ink">
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href as never}
              className="transition hover:text-brand-500"
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
