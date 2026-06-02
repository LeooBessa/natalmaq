// Conteúdo dos artigos do blog da Natalmaq.
// Edite os textos/imagens aqui — a seção (carrossel) e a página /artigos/[slug]
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
  date: string;
  readingTime: string;
  content: ArticleBlock[];
}

export const articles: Article[] = [
  {
    slug: "como-escolher-epi-para-sua-obra",
    category: "Segurança",
    title: "Como escolher o EPI certo para cada etapa da sua obra",
    excerpt:
      "Capacete, luva, óculos, protetor auricular — o equipamento de proteção certo evita acidentes e mantém sua obra dentro da norma. Veja o que considerar em cada escolha.",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1600&q=80",
    date: "26 de maio de 2026",
    readingTime: "6 min de leitura",
    content: [
      {
        type: "paragraph",
        text: "Escolher o Equipamento de Proteção Individual (EPI) correto não é apenas uma exigência da legislação trabalhista — é o que mantém sua equipe segura e produtiva no dia a dia da obra.",
      },
      {
        type: "paragraph",
        text: "Cada atividade exige uma combinação específica de proteção. Usar o EPI errado, ou de qualidade duvidosa, é tão arriscado quanto não usar nenhum.",
      },
      { type: "heading", text: "Comece pela análise de risco" },
      {
        type: "paragraph",
        text: "Antes de comprar qualquer equipamento, identifique os riscos de cada função. As perguntas básicas são:",
      },
      {
        type: "list",
        items: [
          "Há risco de queda de objetos? (capacete)",
          "Há poeira, respingos ou partículas? (óculos e máscara)",
          "O ruído é alto e contínuo? (protetor auricular)",
          "Há manuseio de materiais cortantes ou químicos? (luvas específicas)",
          "Há trabalho em altura? (cinto e talabarte)",
        ],
      },
      { type: "heading", text: "Verifique o Certificado de Aprovação (CA)" },
      {
        type: "paragraph",
        text: "Todo EPI vendido no Brasil precisa ter um número de CA válido, emitido pelo Ministério do Trabalho. Esse número garante que o equipamento foi testado e aprovado para o uso a que se destina.",
      },
      {
        type: "paragraph",
        text: "Na Natalmaq, todos os EPIs que comercializamos possuem CA ativo e procedência das principais marcas do mercado.",
      },
      { type: "heading", text: "Conforto também é segurança" },
      {
        type: "paragraph",
        text: "Um EPI desconfortável acaba sendo deixado de lado pelo trabalhador. Por isso, priorize equipamentos com bom ajuste, ventilação e ergonomia — eles aumentam a adesão da equipe e, na prática, protegem mais.",
      },
    ],
  },
  {
    slug: "manutencao-de-furadeiras-e-parafusadeiras",
    category: "Manutenção",
    title: "Manutenção de furadeiras e parafusadeiras: dobre a vida útil",
    excerpt:
      "Pequenos cuidados de limpeza, lubrificação e armazenamento fazem sua ferramenta elétrica durar muito mais. Confira a rotina recomendada.",
    image:
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1600&q=80",
    date: "22 de maio de 2026",
    readingTime: "5 min de leitura",
    content: [
      {
        type: "paragraph",
        text: "Ferramentas elétricas são um investimento. Com manutenção simples e regular, uma furadeira ou parafusadeira de qualidade pode durar anos a mais do que o esperado.",
      },
      { type: "heading", text: "Depois de cada uso" },
      {
        type: "list",
        items: [
          "Limpe a carcaça e as aberturas de ventilação com um pano seco",
          "Remova poeira e limalha do mandril",
          "Guarde em local seco, longe de umidade",
          "Nunca enrole o cabo de forma apertada perto da saída do motor",
        ],
      },
      { type: "heading", text: "Cuidados com a bateria" },
      {
        type: "paragraph",
        text: "Em modelos sem fio, a bateria é o componente mais sensível. Evite descarregar totalmente, não deixe no carregador por dias e armazene com carga parcial quando ficar muito tempo sem uso.",
      },
      { type: "heading", text: "Quando levar à assistência" },
      {
        type: "paragraph",
        text: "Faíscas excessivas, cheiro de queimado, perda de força ou ruído anormal são sinais de que as escovas ou o motor precisam de atenção. A Natalmaq conta com assistência técnica autorizada para as principais marcas.",
      },
    ],
  },
  {
    slug: "ferramentas-essenciais-para-comecar-na-construcao",
    category: "Guia de compra",
    title: "Ferramentas essenciais para quem está começando na construção",
    excerpt:
      "Montar um kit básico de qualidade é o primeiro passo de qualquer profissional. Listamos o que não pode faltar na sua caixa de ferramentas.",
    image:
      "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1600&q=80",
    date: "18 de maio de 2026",
    readingTime: "7 min de leitura",
    content: [
      {
        type: "paragraph",
        text: "Quem está montando sua primeira caixa de ferramentas profissional muitas vezes fica perdido com tantas opções. A boa notícia é que um kit inicial bem escolhido cobre a maioria das tarefas do dia a dia.",
      },
      { type: "heading", text: "O kit manual indispensável" },
      {
        type: "list",
        items: [
          "Martelo de unha e marreta pequena",
          "Jogo de chaves de fenda e Philips",
          "Alicate universal e alicate de corte",
          "Trena de 5m e nível",
          "Jogo de chaves combinadas",
        ],
      },
      { type: "heading", text: "As elétricas que valem o investimento" },
      {
        type: "paragraph",
        text: "Se for investir em ferramentas elétricas, comece por estas três — elas resolvem a maior parte dos trabalhos:",
      },
      {
        type: "list",
        items: [
          "Furadeira de impacto",
          "Parafusadeira sem fio",
          "Esmerilhadeira angular",
        ],
      },
      { type: "heading", text: "Invista em qualidade, não em quantidade" },
      {
        type: "paragraph",
        text: "É melhor ter poucas ferramentas de marcas confiáveis do que muitas de baixa qualidade. Ferramenta boa dura mais, trabalha melhor e sai mais barata no longo prazo.",
      },
      {
        type: "paragraph",
        text: "Na Natalmaq você encontra todas essas categorias com marcas profissionais e atendimento técnico para tirar suas dúvidas antes de comprar.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
