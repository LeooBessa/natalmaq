// Conteúdo dos artigos do blog da Natalmaq.
// Edite os textos/imagens aqui. A seção (carrossel) e a página /artigos/[slug]
// consomem direto deste arquivo. Imagens podem ser caminhos em /public ou URLs
// do unsplash (liberado no next.config).

export type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export interface Article {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;        // exibição em pt-BR (ex: "26 de maio de 2026")
  isoDate: string;     // machine-readable p/ schema/metadata (ex: "2026-05-26")
  readingTime: string;
  keywords?: string[];
  author?: string;     // default "Equipe Natalmaq"
  content: ArticleBlock[];
  // --- Campos OPCIONAIS retrocompatíveis (SEO Fase 1) ---
  // FAQ e HowTo são campos ESTRUTURADOS dedicados (não blocos de content). São
  // renderizados na página e espelhados no JSON-LD (FAQPage/HowTo). Decisão do
  // doc 00: FAQ/HowTo são estruturados, não viram ArticleBlock.
  faq?: { question: string; answer: string }[];
  howto?: { name: string; steps: { name: string; text: string }[] } | null;
  cluster?: string; // slug do cluster/pillar a que o artigo pertence
}

export const articles: Article[] = [
  {
    slug: "como-escolher-epi-para-sua-obra",
    category: "Segurança",
    title: "Como escolher o EPI certo para cada etapa da sua obra",
    excerpt:
      "Escolher o EPI certo protege a sua equipe, evita multas e mantém a obra dentro da norma. Veja o guia completo de equipamento de proteção individual por tipo de risco, com o que checar antes de comprar.",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1600&q=80",
    date: "26 de maio de 2026",
    isoDate: "2026-05-26",
    readingTime: "7 min de leitura",
    keywords: [
      "EPI",
      "equipamento de proteção individual",
      "como escolher EPI",
      "segurança do trabalho",
      "capacete de segurança",
      "luva de segurança",
      "Certificado de Aprovação CA",
      "EPI para obra",
    ],
    content: [
      {
        type: "paragraph",
        text: "Escolher o EPI certo (Equipamento de Proteção Individual) é uma das decisões mais importantes de qualquer obra. Mais do que cumprir a legislação trabalhista, o equipamento de proteção adequado é o que mantém a sua equipe segura, produtiva e longe de acidentes que custam caro.",
      },
      {
        type: "paragraph",
        text: "Neste guia, você vai entender como selecionar o EPI ideal para cada etapa da obra, quais riscos cada equipamento cobre e o que conferir antes de comprar. Use como checklist na hora de montar ou repor o estoque de segurança da sua empresa.",
      },
      { type: "heading", text: "O que é EPI e por que ele é obrigatório" },
      {
        type: "paragraph",
        text: "EPI é todo dispositivo de uso individual destinado a proteger o trabalhador contra riscos que possam ameaçar sua saúde e segurança. No Brasil, o uso é regulamentado pela Norma Regulamentadora NR-6, e o fornecimento gratuito pela empresa é obrigatório sempre que houver risco na atividade.",
      },
      {
        type: "paragraph",
        text: "Fornecer o EPI correto, treinar o uso e fiscalizar a utilização não é só uma exigência legal. É o que reduz afastamentos, processos e paradas na obra.",
      },
      { type: "heading", text: "Comece pela análise de risco da atividade" },
      {
        type: "paragraph",
        text: "Antes de comprar qualquer equipamento, identifique os riscos de cada função. As perguntas básicas que orientam a escolha do EPI são:",
      },
      {
        type: "list",
        items: [
          "Há risco de queda de objetos sobre a cabeça? Use capacete de segurança",
          "Existe poeira, respingo ou partícula no ar? Use óculos de proteção e máscara respiratória",
          "O ruído é alto e contínuo? Use protetor auricular tipo plug ou concha",
          "Há manuseio de materiais cortantes, abrasivos ou químicos? Use luvas específicas para cada risco",
          "O trabalho é em altura acima de 2 metros? Use cinto de segurança e talabarte",
          "Há risco de choque elétrico? Use luvas e calçados isolantes",
        ],
      },
      {
        type: "paragraph",
        text: "Cada atividade costuma exigir uma combinação de EPIs. Usar o equipamento errado, ou de qualidade duvidosa, é tão arriscado quanto não usar nenhum.",
      },
      { type: "heading", text: "EPI por parte do corpo: o que proteger" },
      {
        type: "list",
        items: [
          "Cabeça: capacete de segurança com jugular para trabalho em altura",
          "Olhos e rosto: óculos de proteção, viseira ou protetor facial para solda e corte",
          "Audição: protetor auricular de inserção ou tipo concha conforme o nível de ruído",
          "Vias respiratórias: máscara PFF1, PFF2 ou respirador com filtro químico",
          "Mãos: luvas de raspa, nitrílica, látex ou anticorte conforme o risco",
          "Pés: botina com biqueira de composite ou aço e solado antiderrapante",
          "Corpo: cinto de segurança, colete refletivo e vestimenta adequada",
        ],
      },
      { type: "heading", text: "Sempre verifique o Certificado de Aprovação (CA)" },
      {
        type: "paragraph",
        text: "Todo EPI vendido no Brasil precisa ter um número de Certificado de Aprovação (CA) válido, emitido pelo Ministério do Trabalho. Esse número garante que o equipamento foi testado e aprovado para o uso a que se destina.",
      },
      {
        type: "paragraph",
        text: "Antes de comprar, confira se o CA está impresso no produto e se continua ativo. Equipamento sem CA ou com CA vencido não tem validade legal e não protege de verdade. Na Natalmaq, todos os EPIs comercializados têm CA ativo e procedência das principais marcas do mercado.",
      },
      { type: "heading", text: "Conforto também é segurança" },
      {
        type: "paragraph",
        text: "Um EPI desconfortável acaba sendo deixado de lado pelo trabalhador. Por isso, priorize equipamentos com bom ajuste, ventilação e ergonomia. Eles aumentam a adesão da equipe e, na prática, protegem mais.",
      },
      {
        type: "paragraph",
        text: "Vale também padronizar tamanhos, manter EPIs reserva em estoque e substituir qualquer peça danificada na hora. Proteção pela metade não é proteção.",
      },
      { type: "heading", text: "Onde comprar EPI com procedência em Natal" },
      {
        type: "paragraph",
        text: "A Natalmaq trabalha com uma linha completa de EPI e segurança, de capacetes e luvas a botinas e proteção respiratória, sempre com Certificado de Aprovação ativo e marcas reconhecidas. Monte um orçamento pelo catálogo e fale com a equipe para receber orientação técnica antes de fechar a compra.",
      },
    ],
  },
  {
    slug: "manutencao-de-furadeiras-e-parafusadeiras",
    category: "Manutenção",
    title: "Manutenção de furadeiras e parafusadeiras: dobre a vida útil",
    excerpt:
      "Pequenos cuidados de limpeza, lubrificação e armazenamento fazem sua furadeira e parafusadeira durarem muito mais. Veja a rotina de manutenção de ferramentas elétricas que evita gasto à toa.",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1600&q=80",
    date: "22 de maio de 2026",
    isoDate: "2026-05-22",
    readingTime: "6 min de leitura",
    keywords: [
      "manutenção de furadeira",
      "manutenção de parafusadeira",
      "ferramenta elétrica",
      "como aumentar vida útil ferramenta",
      "cuidados com bateria de ferramenta",
      "limpeza de furadeira",
    ],
    content: [
      {
        type: "paragraph",
        text: "Ferramentas elétricas são um investimento de trabalho. Com uma rotina simples de manutenção, uma furadeira ou parafusadeira de qualidade pode durar anos a mais do que o esperado, mantendo a força e a precisão do primeiro dia.",
      },
      {
        type: "paragraph",
        text: "A boa notícia é que a maior parte da manutenção preventiva você mesmo faz, sem ferramenta especial. Veja a rotina que recomendamos para quem usa furadeira e parafusadeira no dia a dia.",
      },
      { type: "heading", text: "Limpeza depois de cada uso" },
      {
        type: "paragraph",
        text: "A poeira é o maior inimigo da ferramenta elétrica. Ela entope a ventilação, esquenta o motor e desgasta as peças internas. Por isso, ao terminar o trabalho:",
      },
      {
        type: "list",
        items: [
          "Limpe a carcaça e as aberturas de ventilação com um pano seco ou ar comprimido",
          "Remova poeira e limalha de dentro do mandril",
          "Confira se não há resíduo travando o gatilho ou o seletor de velocidade",
          "Guarde a ferramenta em local seco, longe de umidade e maresia",
          "Nunca enrole o cabo de forma apertada perto da saída do motor",
        ],
      },
      { type: "heading", text: "Lubrificação e mandril" },
      {
        type: "paragraph",
        text: "O mandril precisa girar livre e prender a broca com firmeza. Periodicamente, limpe as castanhas internas e aplique uma gota de óleo leve. Mandril que patina ou trava compromete o furo e força o motor.",
      },
      { type: "heading", text: "Cuidados com a bateria" },
      {
        type: "paragraph",
        text: "Em modelos sem fio, a bateria é o componente mais sensível e mais caro de repor. Para preservar a vida útil:",
      },
      {
        type: "list",
        items: [
          "Evite descarregar a bateria até zerar por completo",
          "Não deixe a bateria no carregador por dias após carregar",
          "Armazene com carga parcial quando for ficar muito tempo sem uso",
          "Evite expor a bateria ao calor extremo ou à luz direta do sol",
        ],
      },
      { type: "heading", text: "Cuidado com as brocas e pontas" },
      {
        type: "paragraph",
        text: "Broca cega e ponta gasta obrigam o motor a trabalhar mais e esquentam a ferramenta. Use a broca certa para cada material, mantenha o jogo organizado e troque pontas de parafusadeira assim que começarem a espanar.",
      },
      { type: "heading", text: "Quando levar à assistência técnica" },
      {
        type: "paragraph",
        text: "Alguns sinais indicam que a ferramenta precisa de atenção profissional. Fique atento a:",
      },
      {
        type: "list",
        items: [
          "Faíscas excessivas saindo do motor",
          "Cheiro de queimado durante o uso",
          "Perda de força mesmo com bateria ou rede cheias",
          "Ruído anormal, trepidação ou folga no eixo",
        ],
      },
      {
        type: "paragraph",
        text: "Esses sintomas costumam apontar desgaste das escovas ou do motor. A Natalmaq conta com assistência técnica autorizada para as principais marcas, com reparo feito em galpão próprio. Levar cedo evita um conserto maior depois.",
      },
    ],
  },
  {
    slug: "ferramentas-essenciais-para-comecar-na-construcao",
    category: "Guia de compra",
    title: "Ferramentas essenciais para quem está começando na construção",
    excerpt:
      "Montar um kit de ferramentas de qualidade é o primeiro passo de qualquer profissional. Veja a lista de ferramentas essenciais para construção, do kit manual às elétricas que valem o investimento.",
    image:
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1600&q=80",
    date: "18 de maio de 2026",
    isoDate: "2026-05-18",
    readingTime: "8 min de leitura",
    keywords: [
      "ferramentas essenciais",
      "kit de ferramentas",
      "ferramentas para construção civil",
      "ferramentas para iniciantes",
      "caixa de ferramentas profissional",
      "primeiras ferramentas",
    ],
    content: [
      {
        type: "paragraph",
        text: "Quem está montando a primeira caixa de ferramentas profissional muitas vezes fica perdido diante de tantas opções. A boa notícia é que um kit de ferramentas inicial bem escolhido já cobre a maioria das tarefas do dia a dia na construção.",
      },
      {
        type: "paragraph",
        text: "A seguir, listamos as ferramentas essenciais para quem está começando, separadas entre manuais e elétricas, para você investir o dinheiro no que realmente faz diferença.",
      },
      { type: "heading", text: "O kit manual indispensável" },
      {
        type: "paragraph",
        text: "São as ferramentas que não podem faltar em nenhuma caixa, usadas em praticamente todo serviço:",
      },
      {
        type: "list",
        items: [
          "Martelo de unha e uma marreta pequena",
          "Jogo de chaves de fenda e Philips de vários tamanhos",
          "Alicate universal e alicate de corte",
          "Trena de 5 metros e nível de bolha",
          "Jogo de chaves combinadas e chave de boca",
          "Estilete, esquadro e lápis de marcação",
        ],
      },
      { type: "heading", text: "As ferramentas elétricas que valem o investimento" },
      {
        type: "paragraph",
        text: "Se for partir para as ferramentas elétricas, comece por estas três. Elas resolvem a maior parte dos trabalhos e se pagam rápido:",
      },
      {
        type: "list",
        items: [
          "Furadeira de impacto, para furar concreto, madeira e metal",
          "Parafusadeira sem fio, para montagem e fixação com agilidade",
          "Esmerilhadeira angular, para cortar e desbastar diversos materiais",
        ],
      },
      {
        type: "paragraph",
        text: "Com o tempo, vale ampliar o kit com serra mármore, lixadeira e uma furadeira de bancada, conforme o tipo de serviço que você mais faz.",
      },
      { type: "heading", text: "Equipamento de proteção entra no kit inicial" },
      {
        type: "paragraph",
        text: "Ferramenta sem proteção é risco. Já no primeiro kit, inclua óculos de proteção, luvas, protetor auricular e calçado de segurança. É o item mais barato e o que mais evita acidente.",
      },
      { type: "heading", text: "Invista em qualidade, não em quantidade" },
      {
        type: "paragraph",
        text: "É melhor ter poucas ferramentas de marcas confiáveis do que muitas de baixa qualidade. Ferramenta boa dura mais, trabalha melhor e sai mais barata no longo prazo, porque você não precisa trocar a cada poucos meses.",
      },
      {
        type: "paragraph",
        text: "Na Natalmaq você encontra todas essas categorias com marcas profissionais e atendimento técnico para tirar dúvidas antes de comprar. Monte seu orçamento pelo catálogo e receba orientação para começar com o kit certo.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
