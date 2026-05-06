"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Headphones,
  Mail,
  MapPin,
  Package,
  Phone,
  Star,
  Target,
  TrendingUp,
  Truck,
} from "lucide-react";

const KEYFRAMES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes expandX {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes bob {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(7px); }
  }
  @keyframes rotateBorder {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(360deg); }
  }
`;

/* ── Scroll reveal ───────────────────────────────────────────────────── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setVisible(true); io.disconnect(); }
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.75s ease ${delay}ms, transform 0.75s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Animated counter ────────────────────────────────────────────────── */

function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !fired.current) {
          fired.current = true;
          const fps = 1000 / 60;
          const steps = 1600 / fps;
          let i = 0;
          const id = setInterval(() => {
            i++;
            setVal(Math.round(end * (i / steps)));
            if (i >= steps) { setVal(end); clearInterval(id); }
          }, fps);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end]);
  return <span ref={ref}>{val.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ── Photo placeholder ───────────────────────────────────────────────── */

function Photo({
  className = "",
  label = "",
  gradient = "",
}: {
  className?: string;
  label?: string;
  gradient?: string;
}) {
  return (
    <div
      className={`group relative flex flex-col items-center justify-center overflow-hidden bg-[#D5D0CA] ${className}`}
    >
      {gradient && (
        <div className={`absolute inset-0 opacity-70 ${gradient}`} />
      )}
      <div className="relative flex flex-col items-center">
        <Camera className="h-9 w-9 text-[#A8A29E] mb-2 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.3} />
        {label && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#A8A29E]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Pill badge ──────────────────────────────────────────────────────── */

function PillBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-mono text-brand-500">
      {children}
    </span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function InstitucionalContent() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className="overflow-x-hidden bg-bone">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative flex min-h-[92vh] flex-col justify-between overflow-hidden bg-navy">
          <div className="absolute inset-0 bg-hatch-orange opacity-60" />
          {/* faint watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="font-display text-[clamp(100px,20vw,260px)] font-black uppercase leading-none text-white/[0.03] tracking-tighter">
              NATALMAQ
            </span>
          </div>
          {/* top accent bar */}
          <div
            className="absolute top-0 left-0 h-[3px] w-full origin-left bg-brand-500"
            style={{ animation: "expandX 1.4s cubic-bezier(.22,1,.36,1) 0.2s both" }}
          />

          {/* content */}
          <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pb-28 pt-36 text-center">
            <p
              className="font-mono text-[11px] uppercase tracking-mono text-brand-400"
              style={{ animation: "fadeUp 0.7s ease 0.35s both" }}
            >
              NATALMAQ · NATAL/RN · DESDE 2008
            </p>
            <h1 className="mt-5 font-display leading-[0.88] tracking-tight text-white">
              {(["18 ANOS", "EQUIPANDO", "QUEM CONSTRÓI", "O NORDESTE."] as const).map(
                (word, i) => (
                  <span
                    key={word}
                    className={`block text-[clamp(48px,7.5vw,96px)] ${i === 2 ? "text-brand-500" : ""}`}
                    style={{ animation: `fadeUp 0.7s ease ${0.48 + i * 0.13}s both` }}
                  >
                    {word}
                  </span>
                )
              )}
            </h1>
            <p
              className="mx-auto mt-8 max-w-md text-[15px] leading-relaxed text-white/60"
              style={{ animation: "fadeUp 0.7s ease 1.05s both" }}
            >
              Ferramentas, máquinas e EPIs para construtoras, indústrias e
              prestadores de serviço — com estoque real e entrega no prazo.
            </p>
            <div
              className="mt-12 inline-flex flex-col items-center gap-2"
              style={{ animation: "fadeUp 0.7s ease 1.25s both" }}
            >
              <span className="font-mono text-[11px] uppercase tracking-mono text-white/60">
                ROLE PARA CONHECER
              </span>
              <ChevronDown
                className="h-5 w-5 text-brand-500"
                style={{ animation: "bob 2s ease-in-out 2.5s infinite" }}
              />
            </div>
          </div>
        </section>

        {/* ── SOBRE ────────────────────────────────────────────── */}
        <section className="bg-white py-20 md:py-28">
          <div className="mx-auto max-w-[1280px] px-6">
            <Reveal>
              <PillBadge>Quem somos</PillBadge>
              <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,44px)] leading-[1.05] tracking-tight text-ink">
                Mais de uma década equipando{" "}
                <span className="text-brand-500">o Nordeste.</span>
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Coluna esquerda */}
              <Reveal delay={80}>
                <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
                  <p>
                    Fundada em 2008 por uma família de eletricistas, a Natalmaq nasceu na zona
                    industrial de Natal/RN como uma pequena loja de ferragens. O sonho era
                    simples: atender bem o profissional que não tem tempo a perder.
                  </p>
                  <p>
                    Hoje, com galpão próprio de 2.400 m², frota de entrega própria e parcerias
                    diretas com mais de 18 fabricantes, atendemos construtoras, indústrias
                    metalmecânicas e prestadores de serviço em todo o Nordeste.
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  {[
                    {
                      Icon: Target,
                      title: "Missão",
                      desc: "Ser o parceiro de insumos mais confiável do profissional nordestino.",
                    },
                    {
                      Icon: Eye,
                      title: "Visão",
                      desc: "Ser referência nacional no fornecimento de ferramentas e EPIs industriais.",
                    },
                    {
                      Icon: Star,
                      title: "Valores",
                      desc: "Agilidade, transparência, qualidade e compromisso com cada cliente.",
                    },
                  ].map(({ Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-4 rounded-sm border border-line bg-bone p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-500/10 text-brand-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-ink">{title}</p>
                        <p className="mt-0.5 text-[13px] text-ink-2">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>

              {/* Coluna direita — checklist */}
              <Reveal delay={160}>
                <div className="rounded-sm border border-line bg-bone p-8">
                  <h3 className="font-display text-[20px] tracking-tight text-ink">
                    Por que escolher a Natalmaq?
                  </h3>
                  <div className="mt-6 space-y-3">
                    {[
                      "Estoque real com +1.670 SKUs sempre disponíveis",
                      "Preço profissional por CNPJ com descontos progressivos",
                      "Entrega própria com 98% de pontualidade no Nordeste",
                      "Pós-venda e assistência técnica autorizada",
                      "Equipe especializada com mais de 15 anos no mercado",
                      "Importação direta dos principais fabricantes",
                      "Atualização de catálogo integrada ao ERP em tempo real",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-sm border border-line bg-white px-4 py-3 transition-colors hover:border-brand-500/30"
                      >
                        <Check className="h-4 w-4 shrink-0 text-brand-500" />
                        <span className="text-[14px] text-ink-2">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── STATS ────────────────────────────────────────────── */}
        <section className="bg-navy">
          <div className="mx-auto max-w-[1280px] px-6 py-16">
            <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-3 lg:grid-cols-6">
              {[
                { end: 2008, label: "FUNDAÇÃO",         suffix: "" },
                { end: 2400, label: "M² DE GALPÃO",     suffix: "+" },
                { end: 18,   label: "MARCAS PARCEIRAS", suffix: "+" },
                { end: 1670, label: "SKUs",              suffix: "+" },
                { end: 4200, label: "CLIENTES B2B",      suffix: "+" },
                { end: 98,   label: "ENTREGA NO PRAZO", suffix: "%" },
              ].map((s) => (
                <div key={s.label} className="bg-navy px-6 py-8">
                  <div className="font-display text-[34px] leading-none text-brand-500">
                    <Counter end={s.end} suffix={s.suffix} />
                  </div>
                  <div className="mt-2 font-mono text-[9px] uppercase tracking-mono text-white/40">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SOLUÇÕES ─────────────────────────────────────────── */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-[1280px] px-6">
            <Reveal className="text-center">
              <PillBadge>O que oferecemos</PillBadge>
              <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,44px)] leading-[1.05] tracking-tight text-ink">
                Soluções completas para{" "}
                <span className="text-brand-500">a sua operação.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
                Do estoque à assistência técnica, a Natalmaq cobre cada etapa
                para que você nunca pare a obra por falta de ferramenta.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  Icon: Package,
                  title: "Estoque Real",
                  desc: "Mais de 1.670 SKUs disponíveis, atualizados diretamente pelo ERP — sem falsas promessas.",
                  items: ["1.670+ produtos", "Atualização automática", "Disponibilidade garantida"],
                  delay: 0,
                },
                {
                  Icon: TrendingUp,
                  title: "Preço Profissional",
                  desc: "Cotação por CNPJ com desconto progressivo por volume e tabela exclusiva de fidelidade.",
                  items: ["Cotação por CNPJ", "Desconto por volume", "Tabela de fidelidade"],
                  delay: 80,
                },
                {
                  Icon: Truck,
                  title: "Entrega Rápida",
                  desc: "Frota própria de entrega com rastreamento e 98% de pontualidade em todo o Nordeste.",
                  items: ["Frota própria", "Rastreamento em tempo real", "98% no prazo"],
                  delay: 160,
                },
                {
                  Icon: Headphones,
                  title: "Pós-Venda Sério",
                  desc: "Assistência autorizada das principais marcas e suporte técnico via WhatsApp.",
                  items: ["Assistência autorizada", "Suporte via WhatsApp", "Garantia real"],
                  delay: 240,
                },
              ].map(({ Icon, title, desc, items, delay }) => (
                <Reveal key={title} delay={delay}>
                  <div className="group flex h-full flex-col border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-500 hover:shadow-md">
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-sm bg-brand-500/10 text-brand-500 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-[18px] tracking-tight text-ink">{title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{desc}</p>
                    <ul className="mt-4 space-y-1.5">
                      {items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-[13px] text-ink-2">
                          <span className="text-brand-500">›</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-5">
                      <span className="cursor-default font-mono text-[11px] uppercase tracking-mono text-brand-500/40">
                        Saiba mais →
                      </span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── GALERIA ──────────────────────────────────────────── */}
        <section className="bg-navy py-20 md:py-28">
          <div className="mx-auto max-w-[1280px] px-6">
            <Reveal>
              <PillBadge>Nossa estrutura</PillBadge>
              <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,44px)] leading-[1.05] tracking-tight text-white">
                Como é aqui dentro.
              </h2>
              <p className="mt-3 max-w-lg text-[15px] text-white/50">
                Conheça o galpão, o estoque e a equipe que fazem a Natalmaq
                funcionar todos os dias.
              </p>
            </Reveal>

            <div className="mt-10 grid auto-rows-[240px] grid-cols-2 gap-3 md:grid-cols-3">
              {/* Imagem principal — slot grande com borda girando */}
              <Reveal className="col-span-2 row-span-2 h-full md:col-span-1 md:row-span-2">
                <div className="relative h-full w-full overflow-hidden" style={{ padding: "3px" }}>
                  {/* borda girando */}
                  <div
                    className="absolute left-1/2 top-1/2 aspect-square w-[210%] pointer-events-none"
                    style={{
                      background: "conic-gradient(transparent 0deg, transparent 250deg, #E8682A 280deg, #FF7A33 300deg, #E8682A 320deg, transparent 350deg)",
                      animation: "rotateBorder 4s linear infinite",
                    }}
                  />
                  {/* imagem */}
                  <div className="absolute inset-[3px] overflow-hidden">
                    <Image
                      src="/brand/Imagens%20NatalMaq/7e35b865-78c2-4330-b0bb-20f8ef17b170.jpg"
                      alt="Natalmaq - Estrutura principal"
                      fill
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/50 to-transparent" />
                  </div>
                </div>
              </Reveal>
              {/* Imagens secundárias */}
              {[
                { src: "/brand/Imagens%20NatalMaq/91f40451-bf76-426c-80cd-70b81b7276fd.jpg", alt: "Natalmaq - Estoque",     delay: 80  },
                { src: "/brand/Imagens%20NatalMaq/b22ed44d-1b5e-485e-b562-ce1c7c168f83.jpg", alt: "Natalmaq - Atendimento", delay: 130 },
                { src: "/brand/Imagens%20NatalMaq/cf15fae7-6b02-49e9-b835-f7f34426d64b.jpg", alt: "Natalmaq - Equipe",      delay: 180 },
                { src: "/brand/Imagens%20NatalMaq/WhatsApp%20Image%202026-05-05%20at%2020.57.42.jpeg", alt: "Natalmaq - Entrega", delay: 230 },
              ].map((item) => (
                <Reveal key={item.alt} delay={item.delay} className="h-full">
                  <div className="relative h-full w-full overflow-hidden">
                    {item.src ? (
                      <>
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          className="object-cover transition-transform duration-500 hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-navy/60 to-transparent" />
                      </>
                    ) : (
                      <Photo className="h-full w-full" label="Em breve" gradient="bg-gradient-to-t from-navy/70 to-transparent" />
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONTATO ──────────────────────────────────────────── */}
        <section className="bg-navy py-20 text-white">
          <div className="mx-auto max-w-[1280px] px-6">
            <Reveal>
              <PillBadge>Fale conosco</PillBadge>
              <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,44px)] leading-[1.05] tracking-tight text-white">
                Estamos prontos para{" "}
                <span className="text-brand-500">atender você.</span>
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:gap-12">
              {/* cards de contato */}
              <div className="flex flex-col gap-4">
                {[
                  {
                    Icon: MapPin,
                    label: "Endereço",
                    content: "R. Pres. Sarmento, 545 - Alecrim, Natal - RN, 59037-400",
                    delay: 0,
                  },
                  {
                    Icon: Phone,
                    label: "Telefone / WhatsApp",
                    content: "(84) 98129-5219",
                    delay: 80,
                  },
                  {
                    Icon: Mail,
                    label: "E-mail",
                    content: "vendas@natalmaq.com.br",
                    delay: 140,
                  },
                  {
                    Icon: Clock,
                    label: "Horário de Atendimento",
                    content: "Seg–Sex: 07:30–17:00 · Sáb: 07:30–12:00 · Dom: Fechado",
                    delay: 200,
                  },
                ].map(({ Icon, label, content, delay }) => (
                  <Reveal key={label} delay={delay}>
                    <div className="flex items-center gap-4 rounded-sm border border-white/10 bg-white/5 px-5 py-4 transition-colors hover:border-brand-500/40">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-brand-500/15 text-brand-500">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-white">{label}</p>
                        <p className="mt-0.5 text-[13px] text-white/55">{content}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}

                <Reveal delay={260}>
                  <a
                    href="https://wa.me/5584981295219"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 bg-brand-500 py-4 font-mono text-[11px] uppercase tracking-mono text-white transition-all hover:gap-3 hover:brightness-110"
                  >
                    Solicitar Orçamento pelo WhatsApp →
                  </a>
                </Reveal>
              </div>

              {/* mapa */}
              <Reveal delay={100}>
                <div className="overflow-hidden rounded-sm border border-white/10 h-full min-h-[420px]">
                  <iframe
                    title="Localização Natalmaq"
                    src="https://maps.google.com/maps?q=R.+Pres.+Sarmento,+545,+Alecrim,+Natal,+RN,+59037-400,+Brasil&output=embed&hl=pt-BR&z=16"
                    width="100%"
                    height="100%"
                    style={{ minHeight: "420px", border: 0, filter: "grayscale(20%) contrast(1.05)" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}
