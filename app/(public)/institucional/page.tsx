export const metadata = { title: "Sobre a Natalmaq" };

export default function InstitucionalPage() {
  return (
    <div className="bg-bone">
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-hatch-orange" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="font-mono text-[12px] uppercase tracking-mono text-brand-400">
              SOBRE NÓS · DESDE 2008
            </div>
            <h1 className="mt-4 font-display text-[44px] leading-[0.9] tracking-tight md:text-[72px]">
              18 ANOS
              <br />
              EQUIPANDO
              <br />
              <span className="text-brand-500">QUEM CONSTRÓI</span>
              <br />O NORDESTE.
            </h1>
          </div>
        </div>
      </section>

      {/* História */}
      <section className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-mono text-brand-500">
              NOSSA HISTÓRIA
            </div>
            <h2 className="mt-3 font-display text-[28px] leading-[1.1] tracking-tight text-ink md:text-[32px]">
              Da loja de bairro à referência industrial.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
              Fundada em 2008 por uma família de eletricistas, a Natalmaq
              nasceu na zona industrial de Natal/RN como uma loja de ferragens.
              Hoje, com galpão próprio, frota de entrega e parcerias com mais
              de uma dezena de fabricantes, atendemos construtoras, indústrias
              metalmecânicas e prestadores de serviço em todo o Nordeste.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Nossa missão é simples: o profissional que confia na Natalmaq
              nunca para a obra por falta de ferramenta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-line">
            {[
              ["2008", "FUNDAÇÃO"],
              ["2.400m²", "GALPÃO"],
              ["18+", "MARCAS PARCEIRAS"],
              ["1.670+", "SKUs"],
              ["4.200", "CLIENTES B2B"],
              ["98%", "ENTREGA NO PRAZO"],
            ].map(([n, l]) => (
              <div key={l} className="bg-white p-6">
                <div className="font-display text-[28px] tracking-tight text-ink">
                  {n}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-ink-2">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Princípios */}
      <section className="mx-auto max-w-[1280px] px-6 pb-20">
        <div className="font-mono text-[11px] uppercase tracking-mono text-brand-500">
          PRINCÍPIOS
        </div>
        <h2 className="mt-3 font-display text-[28px] tracking-tight text-ink md:text-[32px]">
          Como trabalhamos.
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            [
              "01",
              "ESTOQUE REAL",
              "O que está no site, está no galpão. Estoque atualizado por importação direta do nosso ERP.",
            ],
            [
              "02",
              "PREÇO PROFISSIONAL",
              "Cotação por CNPJ com desconto progressivo por volume e fidelidade.",
            ],
            [
              "03",
              "PÓS-VENDA SÉRIO",
              "Assistência autorizada das principais marcas e suporte técnico via WhatsApp.",
            ],
          ].map(([n, t, d]) => (
            <div
              key={n}
              className="border-t-4 border-brand-500 bg-white p-6"
            >
              <div className="font-display text-[36px] leading-none text-line">
                {n}
              </div>
              <div className="mt-2 text-[18px] font-extrabold tracking-tight text-ink">
                {t}
              </div>
              <div className="mt-2 text-[14px] leading-relaxed text-ink-2">
                {d}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contato */}
      <section className="bg-navy py-12 text-white">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
                ENDEREÇO
              </div>
              <div className="mt-2 leading-relaxed">
                Av. Industrial Norte, 2.480
                <br />
                Distrito Industrial · Natal/RN
                <br />
                CEP 59.115-080
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
                ATENDIMENTO
              </div>
              <div className="mt-2 leading-relaxed">
                (84) 3000-0000
                <br />
                vendas@natalmaq.com.br
                <br />
                Seg–Sex 7h–18h · Sáb 7h–12h
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
                CNPJ
              </div>
              <div className="mt-2 leading-relaxed">
                09.493.387/0001-30
                <br />
                Natalmaq Comércio de Ferramentas Ltda
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
