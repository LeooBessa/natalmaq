-- ============================================================================
-- Natalmaq — 0022 SEED do conteudo SEO (Onda 1)
--   Semeia o conteudo editorial da Onda 1 sobre a estrutura criada em 0019
--   (tabelas clusters / artigos / landing_pages) e linkagem de 0020/0021.
--
--   Conteudo:
--     a) 6 clusters (pillar pages) — UPDATE dos campos editoriais
--        (subtitulo, intro, meta_title/description, faq, status, published_at).
--        Os 10 clusters ja existem (criados em 0019); aqui so enriquecemos.
--        Para epi-para-obras vincula-se o artigo-pilar 'como-escolher-epi-para-sua-obra'.
--     b) 7 artigos satelite — INSERT ... ON CONFLICT (slug) DO UPDATE.
--        Slugs distintos dos 3 artigos de 0019 (sem colisao).
--     c) 3 landing pages B2B/local — INSERT ... ON CONFLICT (slug) DO UPDATE.
--
-- Convencoes herdadas (0001/0016/0019): pt-BR; JSONB via dollar-quoting ($json$);
--   texto via dollar-quoting ($txt$); idempotente (UPDATE por slug / ON CONFLICT
--   DO UPDATE). faq no formato canonico do banco [{pergunta, resposta}] e howto
--   {nome, passos:[{nome, texto}]} (lib/conteudo.ts aceita ambos os idiomas).
--   reading_time calculado: ceil(palavras de paragraph+list / 200).
--
-- Depende de 0019 (tabelas + os 10 clusters/keywords + 3 artigos). Reaplicavel.
--
-- OBS (followups): landing_pages NAO tem coluna de CTA (cta_whatsapp_msg). As
--   mensagens de WhatsApp das landings (ctaWhatsappMsg) foram materializadas como
--   bloco 'paragraph' final do corpo. Quando existir a coluna dedicada, migrar.
--   O 'howto' das landings nao tem coluna na tabela (so artigos tem) e foi omitido.
--
-- ----------------------------------------------------------------------------
-- ROLLBACK (remove o conteudo da Onda 1; mantem as linhas-base de 0019):
--   delete from artigos where slug in (
--     'kit-ferramentas-eletricista-profissional','alicate-isolado-nr10',
--     'furadeira-de-impacto-como-escolher','comprar-ferramentas-com-cnpj-vantagens',
--     'bosch-ou-dewalt-profissional','serra-circular-dewalt-ou-bosch-corte-madeira',
--     'como-escolher-fornecedor-de-ferramentas-rn');
--   delete from landing_pages where slug in (
--     'comprar-ferramentas-cnpj-natal-rn','fornecedor-ferramentas-rn',
--     'distribuidor-industrial-natal-rn');
--   -- desfaz o enriquecimento dos clusters da Onda 1 (volta ao estado de 0019):
--   update clusters set subtitulo=null, intro=null, faq='[]'::jsonb,
--     artigo_pilar_id=null
--     where slug in ('fornecedor-industrial-rn','comprar-ferramentas-cnpj',
--       'ferramentas-para-eletricista','furadeira-de-impacto-e-parafusadeira',
--       'bosch-makita-dewalt-profissional','epi-para-obras');
--   update artigos set eh_pilar=false where slug='como-escolher-epi-para-sua-obra';
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- a) Clusters (pillar pages) — enriquecimento editorial da Onda 1.
--    Os 10 clusters ja existem (0019). UPDATE por slug; idempotente.
-- ----------------------------------------------------------------------------

-- Cluster: fornecedor-industrial-rn
update clusters set
  subtitulo        = $txt$Como escolher quem abastece sua obra, indústria ou equipe no RN$txt$,
  intro            = $txt$Escolher o fornecedor de ferramentas RN certo é uma decisão que pesa no caixa e no cronograma de qualquer empresa de construção, indústria, marcenaria, elétrica ou manutenção. O fornecedor errado atrasa a obra por falta de estoque, complica o financeiro por causa de nota fiscal e some quando você precisa de suporte técnico. O fornecedor certo vira parceiro de operação. Este guia reúne, em um só lugar, os critérios que separam um distribuidor industrial confiável de um vendedor avulso, para você comprar com segurança em Natal e no interior do estado.

A intenção aqui é prática. Você não está só pesquisando, está perto de fechar. Por isso, em vez de teoria, mostramos o que conferir antes de comprar: profundidade de estoque (de furadeira e esmerilhadeira a disco, broca, alicate e EPI como capacete, luva e bota), emissão de nota fiscal e compra com CNPJ, prazo real de entrega, suporte técnico para escolher o modelo certo e cobertura logística para chegar ao interior do RN.

Use os blocos abaixo como roteiro de avaliação e siga para os artigos e as páginas comerciais do tema. Se você já tem clareza do que precisa, pode montar o orçamento direto pelo catálogo e fechar pelo WhatsApp, com nota fiscal e atendimento para empresa.$txt$,
  meta_title       = $txt$Fornecedor Industrial RN: Ferramentas e Equipamentos$txt$,
  meta_description = $txt$Como escolher um fornecedor de ferramentas RN: estoque, nota fiscal, prazo e suporte. Distribuidor industrial em Natal com entrega em todo o estado.$txt$,
  faq              = $json$[{"pergunta": "Vocês entregam no interior do RN?", "resposta": "Sim. Atendemos Natal e todo o Rio Grande do Norte, incluindo cidades do interior. Confirme o prazo da sua cidade no orçamento pelo WhatsApp."}, {"pergunta": "Atendem empresas com CNPJ?", "resposta": "Sim. Vendemos para pessoa jurídica com nota fiscal, o que garante garantia para empresa e organização do financeiro. É só informar o CNPJ ao montar o orçamento."}, {"pergunta": "Qual é o prazo de entrega em Natal?", "resposta": "O prazo varia conforme o item e o estoque no momento. A equipe confirma o prazo exato ao fechar o orçamento, antes de você aprovar a compra."}, {"pergunta": "Emitem nota fiscal em toda compra?", "resposta": "Sim. Toda venda sai com nota fiscal, tanto para consumidor final quanto para compra com CNPJ."}, {"pergunta": "Como peço um orçamento?", "resposta": "Selecione os produtos pelo catálogo do site para montar a sua cesta e fale com a equipe pelo WhatsApp. Você recebe o orçamento com os valores, prazo e condições de entrega."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$fornecedor-industrial-rn$txt$;

-- Cluster: comprar-ferramentas-cnpj
update clusters set
  subtitulo        = $txt$Nota fiscal, faturamento, garantia PJ e compra recorrente para sua empresa no RN.$txt$,
  intro            = $txt$A compra B2B de ferramentas industriais com CNPJ funciona diferente da compra de balcão. Quando sua empresa compra com CNPJ, você precisa de nota fiscal correta, condições de faturamento, garantia para pessoa jurídica e, na maioria dos casos, reposição recorrente de estoque para não parar a operação. Este guia reúne tudo o que o gestor de compras precisa saber antes de fechar pedido.

A Natalmaq é fornecedor B2B de máquinas, ferramentas, equipamentos e EPI em Natal/RN, atendendo profissionais e empresas de construção, indústria, marcenaria, elétrica e manutenção em todo o Rio Grande do Norte. Trabalhamos com mais de 11.800 produtos ativos e 341 marcas, de Bosch, DeWalt e Makita a EPI 3M, Kalipso e MSA, sempre com emissão de nota fiscal e compra com CNPJ.

Aqui você entende por que comprar com CNPJ vale a pena (crédito de ICMS, dedução de despesa, garantia PJ), como organizar a compra em volume e quando faz sentido montar uma reposição programada. Use cada bloco abaixo como ponto de partida e siga para os artigos do tema para se aprofundar em vantagens fiscais, compra por volume e como escolher fornecedor. No fim, monte o orçamento direto pelo catálogo e fale com a equipe no WhatsApp para receber as condições da sua empresa.$txt$,
  meta_title       = $txt$Comprar Ferramentas com CNPJ: Guia de Compra B2B$txt$,
  meta_description = $txt$Guia de compra B2B de ferramentas industriais com CNPJ: nota fiscal, faturamento, garantia PJ e compra em volume para empresas em Natal/RN.$txt$,
  faq              = $json$[{"pergunta": "Posso comprar ferramentas com CNPJ?", "resposta": "Sim. A Natalmaq atende empresas de todo o RN com compra B2B usando CNPJ, da furadeira avulsa ao pedido em volume para a equipe."}, {"pergunta": "Vocês emitem nota fiscal para empresa?", "resposta": "Sim. Toda compra com CNPJ sai com nota fiscal eletrônica em nome da empresa, com os dados fiscais corretos para sua contabilidade."}, {"pergunta": "Tem faturamento ou condições de pagamento para PJ?", "resposta": "As condições de faturamento e pagamento variam conforme o porte da compra e o histórico da empresa. Monte o orçamento e fale com a equipe para verificar o que se aplica ao seu CNPJ."}, {"pergunta": "A garantia muda na compra com CNPJ?", "resposta": "A garantia segue o termo de cada fabricante (Bosch, DeWalt, Makita e outras). Ter a nota fiscal em nome da empresa facilita acionar a garantia e a assistência técnica."}, {"pergunta": "Como faço uma compra recorrente ou em volume?", "resposta": "Monte a cesta no catálogo com tudo o que a equipe precisa e envie o CNPJ no WhatsApp. A equipe organiza o orçamento em volume e pode programar a reposição de itens de consumo."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$comprar-ferramentas-cnpj$txt$;

-- Cluster: ferramentas-para-eletricista
update clusters set
  subtitulo        = $txt$O que não pode faltar no kit, ferramentas isoladas NR-10 e como montar o seu.$txt$,
  intro            = $txt$Escolher as ferramentas para eletricista certas é o que separa o serviço rápido e seguro do improviso que coloca você em risco. Trabalhar com energia exige equipamento de qualidade, isolamento adequado e um kit organizado, porque cada falha em uma ferramenta pode virar choque, curto ou retrabalho na instalação.

Este guia reúne tudo o que o eletricista profissional precisa saber para montar e renovar o kit. Você vai entender o que não pode faltar na caixa, quais ferramentas precisam ser isoladas para atender a NR-10 e como equilibrar ferramentas manuais e elétricas no dia a dia, seja em instalação residencial, manutenção predial ou painéis industriais.

Aqui você não encontra encheção. Reunimos os pontos práticos que importam na hora de comprar: tensão de isolamento (1000 V), tipos de alicate, chaves de fenda e Philips com cabo isolado, multímetro, e onde as ferramentas elétricas como furadeira e parafusadeira entram no serviço.

Use esta página como ponto de partida. A partir dela, você acessa os guias detalhados do kit completo e do alicate isolado, e segue direto para o catálogo da Natalmaq para montar seu orçamento. Atendemos profissionais e empresas em Natal e em todo o RN, com nota fiscal e compra com CNPJ.$txt$,
  meta_title       = $txt$Ferramentas para Eletricista: Guia Completo e Kit$txt$,
  meta_description = $txt$Guia de ferramentas para eletricista: o kit profissional completo, alicate isolado NR-10 e manuais x elétricas. Monte seu orçamento em Natal/RN.$txt$,
  faq              = $json$[{"pergunta": "O que não pode faltar no kit de ferramentas de eletricista?", "resposta": "O básico inclui alicate universal, alicate de corte e de bico, decapador, jogo de chaves de fenda e Philips com cabo isolado, chave de teste e multímetro. Para serviço energizado, todas precisam ser ferramentas isoladas conforme a NR-10."}, {"pergunta": "Preciso de ferramenta isolada NR-10?", "resposta": "Sim, sempre que houver trabalho em circuito energizado ou risco de energização. A NR-10 exige ferramentas isoladas certificadas, com o padrão de referência sendo o alicate isolado 1000 V conforme a IEC 60900."}, {"pergunta": "Posso usar alicate comum em instalação elétrica?", "resposta": "Em circuito desenergizado e testado, sim. Em serviço energizado, não: cabo emborrachado comum não é isolamento certificado. Use apenas ferramenta com marcação de 1000 V para atender a norma e proteger você de choque."}, {"pergunta": "Qual a diferença entre ferramentas manuais e elétricas para eletricista?", "resposta": "As manuais (alicates, chaves, multímetro) fazem conexão, medição e acabamento com precisão e segurança. As elétricas (furadeira, parafusadeira, esmerilhadeira) dão força e velocidade para furar, fixar e cortar. Um kit completo tem as duas."}, {"pergunta": "A Natalmaq vende ferramentas para eletricista com nota fiscal e CNPJ?", "resposta": "Sim. Atendemos profissionais e empresas em Natal e em todo o RN, com emissão de nota fiscal e compra com CNPJ. Monte o orçamento pelo catálogo e feche pelo WhatsApp com a equipe."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$ferramentas-para-eletricista$txt$;

-- Cluster: furadeira-de-impacto-e-parafusadeira
update clusters set
  subtitulo        = $txt$A diferença entre as duas, quando usar cada uma e qual comprar primeiro$txt$,
  intro            = $txt$A furadeira de impacto é a ferramenta que combina rotação com batidas rápidas no eixo, o que permite furar concreto, alvenaria e pedra além de madeira e metal. Já a parafusadeira é feita para apertar e soltar parafusos com controle de torque, sem o impacto. Quem está montando o kit costuma confundir as duas, e essa confusão custa caro: ou você compra a ferramenta errada, ou força um equipamento numa tarefa para a qual ele não foi projetado.

Este guia reúne o que você precisa saber para decidir. Aqui você entende a diferença na prática, descobre quando usar cada ferramenta e vê o caminho para escolher o modelo certo, seja Bosch, Makita, DeWalt, Vonder ou Einhell. Os artigos do tema aprofundam cada ponto: o comparativo lado a lado, os critérios de compra de uma furadeira de impacto e os casos em que a parafusadeira de impacto realmente vale a pena.

A regra rápida: se o trabalho é furar parede e materiais duros, a furadeira de impacto resolve. Se é montar móveis, fixar drywall ou apertar parafuso o dia inteiro, a parafusadeira ganha em agilidade e não estraga a cabeça do parafuso. Na maioria das marcenarias, manutenções e obras, as duas se complementam. Use este hub para entender o porquê e depois fale com a equipe da Natalmaq para montar o orçamento com nota fiscal e atendimento técnico.$txt$,
  meta_title       = $txt$Furadeira de Impacto vs Parafusadeira: Guia$txt$,
  meta_description = $txt$Entenda a diferença entre furadeira de impacto e parafusadeira, qual comprar e quando usar cada uma. Modelos Bosch, Makita e DeWalt em Natal/RN.$txt$,
  faq              = $json$[{"pergunta": "Qual a diferença entre furadeira de impacto e parafusadeira?", "resposta": "A furadeira de impacto fura materiais duros como concreto, com rotação e batidas no eixo. A parafusadeira aperta e solta parafusos com torque controlado, sem impacto, protegendo o parafuso e o material."}, {"pergunta": "Furadeira de impacto serve para parafusar?", "resposta": "Serve no aperto, mas sem o controle de embreagem da parafusadeira o risco de espanar o parafuso ou estourar a madeira é maior. Para fixação o dia todo, a parafusadeira é melhor."}, {"pergunta": "Preciso ter as duas ferramentas?", "resposta": "O ideal é sim, porque elas se completam: a furadeira fura e a parafusadeira aperta com precisão. Se só puder comprar uma agora, a furadeira de impacto é a mais versátil."}, {"pergunta": "Qual a potência ideal de uma furadeira de impacto?", "resposta": "Depende do uso. Para serviço pesado em concreto, prefira modelos com mais potência (W) e mandril de 13 mm. Para tarefas leves, modelos menores dão conta. Fale com a equipe para a indicação certa."}, {"pergunta": "Furadeira com fio ou a bateria, qual escolher?", "resposta": "A com fio entrega força constante e não para por causa de carga, boa para uso fixo e pesado. A bateria (12V, 18V ou 20V) dá mobilidade na obra. A escolha depende de onde e como você trabalha."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$furadeira-de-impacto-e-parafusadeira$txt$;

-- Cluster: bosch-makita-dewalt-profissional
update clusters set
  subtitulo        = $txt$Comparativo por ciclo de trabalho, garantia, assistência e custo-benefício$txt$,
  intro            = $txt$A pergunta "qual a melhor marca de ferramenta elétrica" não tem uma resposta única, e quem diz que tem está vendendo. Bosch, Makita e DeWalt são as três grandes da linha profissional, cada uma forte em frentes diferentes. A melhor para você depende do tipo de trabalho, da intensidade de uso, da rede de baterias que você já tem e do orçamento.

Este guia é o ponto de partida para decidir com critério, sem achismo. Aqui você entende os quatro fatores que realmente separam ferramenta profissional de ferramenta doméstica: ciclo de trabalho (quanto a máquina aguenta de uso contínuo), garantia, assistência técnica local e custo-benefício no longo prazo. São esses pontos, e não só o preço da etiqueta, que definem qual marca rende mais na rotina pesada.

Nos artigos do tema, você encontra os comparativos diretos: Bosch vs DeWalt no duelo mais clássico, onde a Makita ganha e onde perde, e como identificar na prática se uma ferramenta é da linha profissional ou da doméstica. Use este hub para se situar e depois aprofunde no que importa para o seu serviço. Na Natalmaq você compra as três marcas com nota fiscal e CNPJ, e conta com a equipe para recomendar o modelo certo antes de fechar o orçamento.$txt$,
  meta_title       = $txt$Bosch vs DeWalt vs Makita: Melhor Marca Profissional$txt$,
  meta_description = $txt$Comparativo completo: Bosch, DeWalt e Makita para uso profissional. Veja qual a melhor marca de ferramenta elétrica para o seu trabalho em Natal/RN.$txt$,
  faq              = $json$[{"pergunta": "Qual a melhor marca de ferramenta elétrica profissional?", "resposta": "Não existe uma única melhor. Bosch, Makita e DeWalt lideram a linha profissional, cada uma forte em frentes diferentes. A melhor para você depende do tipo de trabalho, da intensidade de uso e da plataforma de baterias que você já tem."}, {"pergunta": "Bosch ou DeWalt, qual escolher para uso profissional?", "resposta": "A Bosch linha azul é referência em robustez e tem ampla rede de assistência no Brasil. A DeWalt se destaca em ferramentas a bateria de alta performance e itens de marcenaria. Se já usa uma das marcas, manter a mesma bateria costuma pesar na decisão."}, {"pergunta": "A Makita vale a pena frente a Bosch e DeWalt?", "resposta": "Sim, especialmente em custo-benefício e em ferramentas a bateria leves e equilibradas, muito usadas em marcenaria e manutenção. Compare por categoria, porque em alguns usos pesados Bosch ou DeWalt levam vantagem."}, {"pergunta": "Como saber se a ferramenta é da linha profissional ou doméstica?", "resposta": "Olhe a cor da carcaça, o código do modelo, a potência em W, a rotação em rpm e o tipo de garantia. A linha profissional aguenta ciclo de trabalho contínuo; a doméstica trabalha em ciclos curtos com pausas."}, {"pergunta": "A garantia é a mesma entre as três marcas?", "resposta": "Não. Prazo e cobertura variam entre marcas e entre linhas (profissional e doméstica) de cada fabricante. Confira sempre o que a garantia cobre antes de comprar. A equipe da Natalmaq orienta no orçamento."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$bosch-makita-dewalt-profissional$txt$;

-- Cluster: epi-para-obras
update clusters set
  subtitulo        = $txt$EPI por risco e por função, com CA ativo, para deixar o canteiro dentro da NR-6.$txt$,
  intro            = $txt$O EPI para construção civil é o que separa um canteiro seguro de um canteiro que acumula afastamentos, multas e paradas. Equipamento de Proteção Individual é todo dispositivo de uso pessoal que protege o trabalhador contra riscos de queda de objetos, poeira, ruído, corte, choque e trabalho em altura. No Brasil, o uso é regulado pela NR-6, e fornecer o EPI gratuitamente sempre que houver risco é obrigação da empresa.

Este hub reúne tudo o que você precisa para acertar na compra e na gestão do equipamento de proteção individual na obra. A lógica é simples: primeiro você identifica o risco de cada função, depois escolhe o EPI certo por parte do corpo (capacete, óculos, máscara, protetor auricular, luva e bota) e, por fim, confere se cada item tem Certificado de Aprovação (CA) ativo. Sem CA válido, o EPI não tem validade legal e não protege de verdade.

Aqui você encontra o caminho para os conteúdos do tema: o guia completo de como escolher o EPI por etapa da obra, a lista do que é EPI obrigatório no canteiro por função e como validar o CA antes de comprar. Use estas páginas como checklist para montar ou repor o estoque de segurança da sua empresa, com nota fiscal e compra com CNPJ.$txt$,
  meta_title       = $txt$EPI para Construção Civil: Guia de Proteção Individual$txt$,
  meta_description = $txt$Guia de EPI para construção civil: o que é obrigatório na obra, como escolher por risco e função, conferir o CA e onde comprar com procedência em Natal/RN.$txt$,
  faq              = $json$[{"pergunta": "Quais EPIs são obrigatórios na obra?", "resposta": "Depende do risco da atividade, mas o básico do canteiro costuma incluir capacete, óculos de proteção, luva, bota de segurança, protetor auricular e máscara respiratória. Trabalho em altura acima de 2 metros exige cinto de segurança e talabarte."}, {"pergunta": "Como escolher EPI por função?", "resposta": "Primeiro identifique o risco de cada função (queda, poeira, ruído, corte, choque, altura) e depois selecione o equipamento por parte do corpo. Pedreiro, eletricista e soldador usam combinações diferentes de EPI conforme o que cada um enfrenta."}, {"pergunta": "O que é o CA do EPI?", "resposta": "CA é o Certificado de Aprovação, um número emitido pelo Ministério do Trabalho que comprova que o EPI foi testado e aprovado para o uso a que se destina. Sem CA válido, o equipamento não tem validade legal e não protege de verdade."}, {"pergunta": "Quem deve fornecer o EPI, a empresa ou o trabalhador?", "resposta": "A empresa. Pela NR-6, o fornecimento do EPI adequado ao risco é gratuito e obrigatório por conta do empregador, que também deve treinar o uso, exigir a utilização e substituir o equipamento danificado."}, {"pergunta": "Onde comprar EPI com CA ativo em Natal/RN?", "resposta": "Na Natalmaq você encontra a linha completa de EPI (capacete, óculos, máscara, protetor, luva e bota) com CA ativo e marcas como 3M, MSA e Marluvas. Monte o orçamento pelo catálogo e feche pelo WhatsApp, com nota fiscal e compra com CNPJ."}]$json$::jsonb,
  status           = 'publicado',
  published_at     = coalesce(published_at, now())
where slug = $txt$epi-para-obras$txt$;

-- Artigo-pilar conhecido: vincula clusters.artigo_pilar_id e marca eh_pilar.
update clusters set artigo_pilar_id = (select id from artigos where slug = $txt$como-escolher-epi-para-sua-obra$txt$)
  where slug = $txt$epi-para-obras$txt$;
update artigos set eh_pilar = true where slug = $txt$como-escolher-epi-para-sua-obra$txt$;

-- ----------------------------------------------------------------------------
-- b) Artigos satelite — INSERT ... ON CONFLICT (slug) DO UPDATE.
--    cluster_id via subselect por clusterSlug; reading_time calculado.
-- ----------------------------------------------------------------------------

-- Artigo: kit-ferramentas-eletricista-profissional  (cluster ferramentas-para-eletricista, reading_time=6)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$kit-ferramentas-eletricista-profissional$txt$,
  $txt$Kit de ferramentas para eletricista profissional: lista completa$txt$,
  $txt$Guia de compra$txt$,
  $txt$O kit de ferramentas para eletricista profissional vai muito além do alicate universal. Veja a lista completa por nível, do iniciante ao avançado, com alicate isolado NR-10, chaves isoladas, multímetro, detector de tensão e EPI.$txt$,
  $json$[{"type": "paragraph", "text": "Montar um kit de ferramentas para eletricista profissional é o que separa o serviço seguro e rápido do improviso que coloca você e a instalação em risco. O kit ideal junta ferramentas de corte e fixação, instrumentos de medição, ferramentas isoladas para trabalho energizado e o EPI exigido pela NR-10. Neste guia você tem a lista completa, organizada por nível, do eletricista iniciante ao profissional que atende indústria e prediais."}, {"type": "paragraph", "text": "A ideia não é comprar tudo de uma vez. É começar pela base certa e ampliar conforme o tipo de serviço que você mais faz, residencial, predial ou industrial. Use os blocos abaixo como checklist na hora de montar ou repor a sua maleta."}, {"type": "heading", "text": "Por que o kit do eletricista é diferente"}, {"type": "paragraph", "text": "Eletricista trabalha com risco elétrico, e isso muda tudo na escolha das ferramentas. A NR-10 (segurança em instalações e serviços em eletricidade) exige ferramentas isoladas para trabalho em ou próximo de partes energizadas. Por isso o kit precisa de itens com isolação certificada para 1000 V, identificados com o duplo triângulo e a marcação 1000V."}, {"type": "paragraph", "text": "Uma ferramenta isolada não é só o cabo com plástico em volta. A isolação é testada e cobre toda a região de contato, protegendo contra choque mesmo em redes de baixa tensão. Cabo de borracha comum não substitui, e usar ferramenta comum em circuito energizado é justamente o tipo de prática que a norma proíbe."}, {"type": "heading", "text": "Kit ferramentas eletricista profissional: a base manual"}, {"type": "paragraph", "text": "Antes de pensar em ferramenta elétrica ou instrumento, monte a base manual. É o que você usa em quase todo serviço de instalação, manutenção e reparo:"}, {"type": "list", "items": ["Alicate universal, para cortar, dobrar e segurar condutores", "Alicate de corte diagonal, para cortar fios rente sem esmagar", "Alicate de bico (meia-cana), para alcançar pontos apertados e fazer olhais", "Alicate decapador (desencapador), para tirar a isolação na bitola certa sem ferir o cobre", "Jogo de chaves de fenda e Philips de vários tamanhos, incluindo modelos de precisão", "Chave de teste (busca-polo), para checagem rápida de fase", "Estilete, trena e canivete de eletricista para acabamento e passagem de cabo"]}, {"type": "paragraph", "text": "Marcas como Tramontina, Gedore, Irwin e Stanley cobrem bem essa base manual, com cabo ergonômico e aço que aguenta uso pesado. Vale comprar o jogo de alicates de uma marca só para padronizar pegada e durabilidade."}, {"type": "heading", "text": "Ferramentas isoladas NR-10: o que não pode faltar"}, {"type": "paragraph", "text": "Aqui está o que diferencia o profissional. Se você mexe em circuito energizado, mesmo que raramente, precisa de ferramentas isoladas 1000 V. O mínimo recomendável é:"}, {"type": "list", "items": ["Alicate universal isolado 1000 V, marcação NR-10", "Alicate de corte e alicate de bico isolados, para o mesmo nível de tensão", "Jogo de chaves de fenda e Philips isoladas 1000 V, com haste protegida até a ponta", "Chave de teste isolada de qualidade, não a de R$ 5 do balcão"]}, {"type": "paragraph", "text": "Confira sempre a marcação 1000V e o símbolo de duplo triângulo no corpo da ferramenta, além do certificado do fabricante. Ferramenta isolada com a capa rachada, cortada ou descascada perde a proteção e deve ser substituída na hora. Não dá para confiar a sua segurança em uma isolação danificada."}, {"type": "heading", "text": "Instrumentos de medição: multímetro e detector de tensão"}, {"type": "paragraph", "text": "Diagnóstico bom começa com medição confiável. Dois instrumentos são obrigatórios no kit:"}, {"type": "list", "items": ["Multímetro digital, para medir tensão (V), corrente, resistência e continuidade. Para uso profissional, escolha modelo com categoria de segurança CAT III ou superior", "Detector de tensão sem contato (caneta de tensão), que aponta presença de fase só de aproximar, ideal para checagem rápida antes de tocar no circuito", "Alicate amperímetro (alicate-watt), para medir corrente sem abrir o circuito, muito útil em manutenção predial e industrial"]}, {"type": "paragraph", "text": "O detector de tensão é barato e salva vidas: use sempre para confirmar que o circuito está desligado antes de trabalhar nele. A Hikari é uma referência conhecida em multímetros e instrumentos de medição para o eletricista brasileiro."}, {"type": "heading", "text": "Ferramentas elétricas que aceleram o serviço"}, {"type": "paragraph", "text": "Com a base montada, as ferramentas elétricas certas reduzem muito o tempo de obra. Para o eletricista, comece por estas:"}, {"type": "list", "items": ["Furadeira de impacto, para furar parede, concreto e fixar eletrodutos e quadros. Modelos como a Bosch GSB 13 RE dão conta da rotina com mandril de 13 mm", "Parafusadeira a bateria, para fixação rápida de tomadas, espelhos e calhas sem cansar o pulso", "Lanterna de cabeça ou de mão de boa potência, porque muito serviço acontece em forro, sótão e quadro sem luz"]}, {"type": "paragraph", "text": "Bosch, Makita, DeWalt, Vonder e Einhell cobrem diferentes faixas de uso e de investimento. Para quem trabalha o dia todo, vale priorizar a linha profissional, que tem ciclo de trabalho maior e suporta o uso contínuo sem perder força."}, {"type": "heading", "text": "EPI do eletricista: proteção obrigatória"}, {"type": "paragraph", "text": "O EPI não é acessório, é parte do kit e é exigência da NR-6 e da NR-10. Para trabalho em eletricidade, o básico inclui:"}, {"type": "list", "items": ["Luva isolante de borracha para a classe de tensão do serviço, usada com luva de cobertura de raspa por cima", "Óculos de proteção contra arco e partículas", "Capacete classe B (isolante elétrico) quando houver risco de choque na cabeça", "Calçado de segurança com solado isolante e bota sem componentes metálicos expostos"]}, {"type": "paragraph", "text": "Confira sempre o Certificado de Aprovação (CA) ativo de cada EPI. Marcas como 3M, MSA, Marluvas e Kalipso são referência em proteção e têm CA válido. EPI sem CA não tem validade legal e não protege de verdade."}, {"type": "heading", "text": "Checklist por nível: do iniciante ao profissional"}, {"type": "list", "items": ["Iniciante: alicate universal, alicate de corte, alicate de bico, alicate decapador, jogo de chaves de fenda e Philips, chave de teste, fita isolante, multímetro básico, furadeira de impacto e EPI essencial", "Intermediário: adicione alicates e chaves isoladas 1000 V (NR-10), detector de tensão sem contato, parafusadeira a bateria, lanterna potente e luva isolante", "Profissional: complete com alicate amperímetro, multímetro CAT III, jogo completo de ferramentas isoladas, instrumentos de teste de continuidade e maleta organizadora resistente"]}, {"type": "paragraph", "text": "Não esqueça dos consumíveis que somem rápido: fita isolante de boa qualidade, abraçadeiras (cintas de nylon), terminais, conectores e fita autofusão. Mantenha sempre reposição na maleta para não parar o serviço por falta de um item de centavos."}, {"type": "heading", "text": "Onde montar o seu kit em Natal e no RN"}, {"type": "paragraph", "text": "Na Natalmaq você encontra todas essas categorias em um só lugar: alicates, chaves, ferramentas isoladas, instrumentos de medição, furadeiras, parafusadeiras e EPI com CA ativo, das principais marcas. Monte seu orçamento pelo catálogo e fale com a equipe no WhatsApp para receber orientação técnica antes de fechar. Atendemos profissionais e empresas em todo o Rio Grande do Norte, com nota fiscal e compra com CNPJ."}]$json$::jsonb,
  (select id from clusters where slug = $txt$ferramentas-para-eletricista$txt$),
  false,
  $txt$Kit de Ferramentas para Eletricista Profissional$txt$,
  $txt$Monte o kit de ferramentas para eletricista profissional com a lista completa por nível: alicates, chaves isoladas NR-10, multímetro, EPI e mais. Veja o checklist.$txt$,
  array[
      $kw$kit ferramentas eletricista profissional$kw$,
      $kw$ferramentas para eletricista$kw$,
      $kw$lista de ferramentas eletricista$kw$,
      $kw$alicate isolado NR-10$kw$,
      $kw$chave isolada$kw$,
      $kw$multímetro eletricista$kw$,
      $kw$detector de tensão$kw$,
      $kw$kit eletricista profissional$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  6,
  $json$[{"pergunta": "O que ter no kit básico de eletricista?", "resposta": "Alicate universal, alicate de corte, alicate de bico, alicate decapador, jogo de chaves de fenda e Philips, chave de teste, fita isolante, multímetro e furadeira de impacto. Some o EPI essencial: luva, óculos e calçado de segurança."}, {"pergunta": "E no kit de eletricista profissional, o que muda?", "resposta": "O profissional acrescenta ferramentas isoladas 1000 V (NR-10), detector de tensão sem contato, alicate amperímetro, multímetro CAT III e luva isolante de borracha. É o conjunto que permite trabalhar com segurança em circuitos energizados."}, {"pergunta": "Preciso de ferramenta isolada NR-10?", "resposta": "Sim, sempre que houver trabalho em ou próximo de partes energizadas. A NR-10 exige ferramentas com isolação certificada para 1000 V, identificadas pela marcação 1000V e pelo símbolo de duplo triângulo. Ferramenta comum não substitui."}, {"pergunta": "Quanto custa montar um kit de eletricista?", "resposta": "Depende do nível e das marcas. Dá para começar com a base manual e ampliar aos poucos com isoladas, medição e elétricas. Monte um orçamento pelo catálogo da Natalmaq e fale com a equipe para fechar o melhor conjunto pelo seu uso."}, {"pergunta": "Vocês vendem ferramentas com nota fiscal e CNPJ?", "resposta": "Sim. A Natalmaq atende profissionais e empresas em todo o RN com nota fiscal e compra com CNPJ. Monte seu orçamento e finalize pelo WhatsApp."}]$json$::jsonb,
  $json${"nome": "Como montar o kit de ferramentas para eletricista profissional", "passos": [{"nome": "Comece pela base manual", "texto": "Reúna os alicates essenciais (universal, corte, bico e decapador), o jogo de chaves de fenda e Philips e a chave de teste. É o que você usa em quase todo serviço de instalação e reparo."}, {"nome": "Adicione as ferramentas isoladas NR-10", "texto": "Inclua alicates e chaves isoladas 1000 V, com marcação 1000V e duplo triângulo, para trabalhar com segurança em circuitos energizados conforme a NR-10."}, {"nome": "Inclua os instrumentos de medição", "texto": "Adicione um multímetro digital (de preferência CAT III), um detector de tensão sem contato e, para uso pesado, um alicate amperímetro. Sem medição confiável não há diagnóstico seguro."}, {"nome": "Acrescente as ferramentas elétricas", "texto": "Some uma furadeira de impacto, uma parafusadeira a bateria e uma lanterna potente para acelerar fixações e trabalhar em pontos sem iluminação."}, {"nome": "Feche com o EPI obrigatório", "texto": "Complete com luva isolante, óculos de proteção, capacete classe B e calçado de segurança, todos com Certificado de Aprovação (CA) ativo, como exigem a NR-6 e a NR-10."}]}$json$::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: alicate-isolado-nr10  (cluster ferramentas-para-eletricista, reading_time=6)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$alicate-isolado-nr10$txt$,
  $txt$Alicate isolado NR10: o que é, quando usar e como escolher$txt$,
  $txt$Segurança$txt$,
  $txt$Alicate isolado é item obrigatório para quem trabalha com energia. Veja o que a NR-10 exige, o que significa o isolamento 1000V e como conferir a marcação antes de comprar.$txt$,
  $json$[{"type": "paragraph", "text": "O alicate isolado NR10 é a ferramenta projetada para proteger o eletricista contra choque ao trabalhar em circuitos energizados. Diferente de um alicate comum, ele tem isolamento testado para suportar tensão de até 1000V em corrente alternada, e o seu uso é cobrado pela Norma Regulamentadora NR-10 sempre que existe risco elétrico na atividade."}, {"type": "paragraph", "text": "Neste guia você vai entender o que caracteriza uma ferramenta isolada de verdade, quando a NR-10 a torna obrigatória, como conferir a marcação VDE/IEC 60900 e por que improvisar com um alicate de cabo plástico comum coloca a vida em risco. Use como referência antes de equipar a sua equipe."}, {"type": "heading", "text": "O que é um alicate isolado e o que ele NÃO é"}, {"type": "paragraph", "text": "Alicate isolado é a ferramenta cujo isolamento foi fabricado e testado para resistir a uma tensão elétrica definida, protegendo quem segura mesmo em contato com partes energizadas. O isolamento é parte construtiva da ferramenta, aplicado diretamente sobre o metal e aprovado em ensaio dielétrico de fábrica."}, {"type": "paragraph", "text": "Cuidado com a confusão mais comum do dia a dia: cabo emborrachado não é a mesma coisa que isolamento. Muito alicate barato tem apenas uma capa plástica de conforto, sem nenhum ensaio de tensão. Essa capa serve para a mão não escorregar, e não para barrar corrente. Em serviço energizado, ela falha."}, {"type": "list", "items": ["Alicate isolado: isolamento aprovado em ensaio dielétrico, marcação 1000V e símbolo do duplo triângulo", "Alicate isolante: termo usado como sinônimo, mesma exigência técnica de isolamento testado", "Alicate comum com cabo emborrachado: apenas conforto e antiderrapante, sem proteção contra choque", "Alicate VDE: certificado conforme o padrão alemão VDE, que segue a norma internacional IEC 60900"]}, {"type": "heading", "text": "O que a NR-10 exige sobre ferramenta isolada"}, {"type": "paragraph", "text": "A NR-10 é a norma de segurança em instalações e serviços em eletricidade. Ela determina que toda intervenção em circuito energizado, ou que possa ser energizado, seja feita com ferramentas, equipamentos e EPI adequados ao risco. Na prática, isso significa ferramenta isolada para o eletricista que não pode desligar a alimentação."}, {"type": "paragraph", "text": "A regra de ouro continua sendo desenergizar o circuito sempre que possível, seguindo bloqueio e teste de ausência de tensão. Quando a desenergização não é viável, ou nas etapas de medição e verificação, a ferramenta isolada deixa de ser opcional. Ela compõe o conjunto de proteção previsto na norma, junto com luvas isolantes de borracha, calçado adequado e os demais EPIs."}, {"type": "paragraph", "text": "Vale lembrar que a NR-10 anda lado a lado com a NR-6, que trata do EPI. A empresa é responsável por fornecer a ferramenta e o equipamento de proteção corretos, e o profissional precisa receber treinamento para o trabalho com eletricidade. Ferramenta certa sem capacitação, ou capacitação sem ferramenta certa, não cumpre a norma."}, {"type": "heading", "text": "Isolamento 1000V: o que esse número significa"}, {"type": "paragraph", "text": "A ferramenta isolada 1000V é a referência para a maioria dos trabalhos em baixa tensão, faixa que cobre as instalações prediais, comerciais e a maior parte da indústria. O número indica a tensão nominal de uso em corrente alternada para a qual o isolamento foi projetado e aprovado."}, {"type": "paragraph", "text": "Esse valor de uso não é o mesmo do ensaio de fábrica. Conforme a IEC 60900, cada ferramenta isolada para 1000V em corrente alternada passa por um teste dielétrico com tensão bem mais alta, na casa dos milhares de volts, para garantir margem de segurança. Em corrente contínua, a referência de uso costuma ser indicada como 1500V."}, {"type": "list", "items": ["1000V em corrente alternada: tensão de uso para instalações em baixa tensão", "1500V em corrente contínua: referência de uso quando a aplicação é em CC", "Ensaio dielétrico de fábrica: tensão de teste muito superior à de uso, para garantir margem", "Faixa de baixa tensão: até 1000V em CA, onde o alicate isolado 1000V se aplica"]}, {"type": "heading", "text": "Como conferir se o alicate é isolado de verdade"}, {"type": "paragraph", "text": "Antes de comprar ou usar, faça a inspeção visual e cheque a marcação. Uma ferramenta isolada certificada traz informações gravadas no próprio corpo, e não apenas impressas na embalagem. Procure por estes pontos:"}, {"type": "list", "items": ["Marcação 1000V gravada no corpo da ferramenta", "Símbolo do duplo triângulo, que identifica a ferramenta isolada conforme a IEC 60900", "Selo VDE ou referência à norma IEC 60900, sinal de ensaio dielétrico aprovado", "Isolamento em duas camadas, normalmente de cores contrastantes, que ajuda a enxergar dano até a camada interna", "Superfície íntegra: sem trincas, cortes, ressecamento, bolhas ou material derretido"]}, {"type": "paragraph", "text": "A inspeção não termina na compra. Antes de cada serviço energizado, examine o isolamento. Qualquer corte que exponha a camada interna, marca de queimadura ou perfuração tira a ferramenta de operação na hora. Isolamento danificado não se conserta com fita, a ferramenta é descartada e substituída."}, {"type": "heading", "text": "O risco real de usar alicate comum em serviço energizado"}, {"type": "paragraph", "text": "Usar um alicate comum em circuito vivo é apostar a vida na capa plástica do cabo. Essa capa não foi testada para tensão nenhuma. Em contato com a parte energizada, a corrente atravessa a ferramenta e segue para a mão do operador, com risco de choque, queimadura grave e parada cardíaca."}, {"type": "paragraph", "text": "Há ainda o risco de curto-circuito e arco elétrico. Ao encostar acidentalmente em dois pontos de potencial diferente, o alicate sem isolamento fecha o circuito, gera arco e pode projetar metal em fusão e provocar explosão no quadro. O prejuízo vai do operador ao patrimônio e à parada da operação."}, {"type": "paragraph", "text": "Some a isso a questão legal: ferramenta inadequada em serviço energizado é descumprimento da NR-10, com exposição da empresa a autuação, embargo e responsabilização em caso de acidente. O alicate isolado certificado custa mais que o comum, mas é barato perto do que evita."}, {"type": "heading", "text": "Como escolher e onde comprar com nota fiscal"}, {"type": "paragraph", "text": "Para montar ou repor o kit do eletricista, escolha o alicate isolado pela aplicação. Alicate universal isolado para corte e prensagem geral, alicate de corte diagonal isolado para cabos, alicate de bico isolado para áreas apertadas e desencapador para preparar os fios. Para todos, exija a marcação 1000V e o selo de certificação. Vale tratar a ferramenta isolada como conjunto, junto das luvas isolantes e do restante do EPI previsto na NR-6 e na NR-10."}, {"type": "paragraph", "text": "Na Natalmaq você encontra a linha de alicate isolado e as demais ferramentas para eletricista de marcas profissionais, com procedência e nota fiscal para compra com CNPJ. Monte o orçamento pelo catálogo e fale com a equipe no WhatsApp para orientação técnica antes de fechar. Para entender as normas que regem o trabalho com eletricidade e segurança, vale também conferir o nosso guia de normas NR de segurança no trabalho."}]$json$::jsonb,
  (select id from clusters where slug = $txt$ferramentas-para-eletricista$txt$),
  false,
  $txt$Alicate isolado NR10: o que é e como escolher$txt$,
  $txt$Alicate isolado NR10: entenda a exigência da norma, o isolamento 1000V, como conferir a marcação VDE e por que nunca usar alicate comum em serviço energizado.$txt$,
  array[
      $kw$alicate isolado nr10$kw$,
      $kw$ferramenta isolada 1000v$kw$,
      $kw$nr10$kw$,
      $kw$alicate isolado 1000v$kw$,
      $kw$ferramenta isolada eletricista$kw$,
      $kw$marcação VDE alicate$kw$,
      $kw$IEC 60900$kw$,
      $kw$alicate para eletricista$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  6,
  $json$[{"pergunta": "O que é um alicate isolado?", "resposta": "É a ferramenta com isolamento fabricado e aprovado em ensaio dielétrico para resistir a uma tensão definida, em geral 1000V em corrente alternada. Protege o eletricista contra choque ao trabalhar em partes energizadas."}, {"pergunta": "Quando a NR-10 exige ferramenta isolada?", "resposta": "Sempre que houver intervenção em circuito energizado ou que possa ser energizado, e nas etapas de medição e verificação. A regra é desenergizar quando possível; quando não dá, a ferramenta isolada e o EPI são obrigatórios."}, {"pergunta": "Como conferir se o alicate suporta 1000V?", "resposta": "Procure a marcação 1000V gravada no corpo, o símbolo do duplo triângulo e o selo VDE ou a referência à IEC 60900. Inspecione o isolamento em busca de cortes, trincas ou queimaduras antes de cada uso."}, {"pergunta": "Posso usar alicate comum em serviço energizado?", "resposta": "Não. A capa emborrachada do alicate comum é apenas antiderrapante e não foi testada para tensão. Em circuito vivo há risco de choque, queimadura, arco elétrico e descumprimento da NR-10."}, {"pergunta": "Qual a diferença entre cabo emborrachado e isolamento certificado?", "resposta": "O cabo emborrachado dá conforto e firmeza à mão, sem proteção elétrica. O isolamento certificado é construtivo, aplicado sobre o metal e aprovado em ensaio dielétrico, com marcação 1000V e selo da norma."}]$json$::jsonb,
  null::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: furadeira-de-impacto-como-escolher  (cluster furadeira-de-impacto-e-parafusadeira, reading_time=6)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$furadeira-de-impacto-como-escolher$txt$,
  $txt$Furadeira de impacto: como escolher (potência, mandril, impacto)$txt$,
  $txt$Guia de compra$txt$,
  $txt$Para escolher a furadeira de impacto certa, olhe potência, mandril (10 ou 13mm), função impacto, rotação e peso. Veja os critérios que importam, recomendações por uso e onde a Bosch GSB 13 RE se encaixa.$txt$,
  $json$[{"type": "paragraph", "text": "Para escolher uma furadeira de impacto, olhe cinco coisas na ordem: potência em watts, o mandril (10 ou 13mm), a presença real da função impacto, a rotação por minuto e o peso. A furadeira de impacto é a ferramenta que fura concreto, alvenaria, madeira e metal porque combina rotação com uma vibração rápida no eixo, e é por isso que ela resolve mais tarefas do que uma furadeira comum. Neste guia você entende cada critério e descobre qual perfil de máquina combina com o seu serviço."}, {"type": "paragraph", "text": "A ideia é simples: comprar a furadeira certa de primeira, sem pagar por potência que você não usa nem ficar na mão no meio da obra. Vamos ao que pesa na decisão."}, {"type": "heading", "text": "Potência em watts: quanto você realmente precisa"}, {"type": "paragraph", "text": "A potência (medida em watts) indica a força do motor. Mais watts significam mais capacidade de furar materiais duros sem o motor sofrer ou perder rotação sob carga. Mas potência alta também pesa mais e custa mais, então o ideal é casar a potência com o tipo de trabalho."}, {"type": "list", "items": ["Até 550W: uso doméstico e reparos leves, furos pequenos em madeira, drywall e metal fino.", "550W a 700W: a faixa mais versátil, dá conta de alvenaria, concreto leve e uso frequente. É onde fica a Bosch GSB 13 RE.", "Acima de 700W: uso pesado e contínuo, concreto estrutural e brocas de maior diâmetro o dia inteiro."]}, {"type": "paragraph", "text": "Para quem trabalha todos os dias, não vá no limite de baixo. Uma máquina que opera sempre forçada esquenta, perde força e tem vida útil menor. Sobrar um pouco de potência sai mais barato no longo prazo."}, {"type": "heading", "text": "Mandril da furadeira: 10mm ou 13mm"}, {"type": "paragraph", "text": "O mandril é a peça que prende a broca. O número (10mm ou 13mm) é o diâmetro máximo de haste que ele aceita. Quanto maior o mandril, maior a broca que cabe e mais grosso o furo que você consegue fazer. Esse é um dos pontos que mais diferencia uma furadeira de impacto profissional de uma doméstica."}, {"type": "list", "items": ["Mandril de 10mm: suficiente para furos finos e médios, comum em modelos compactos e mais leves.", "Mandril de 13mm: aceita brocas mais grossas, é o padrão de quem fura concreto e metal com frequência. Mais versátil para o profissional.", "Mandril de aperto rápido (sem chave) x com chave: o de aperto rápido agiliza a troca de broca; o de chave costuma travar com mais firmeza em serviço pesado."]}, {"type": "paragraph", "text": "Para uso profissional, a recomendação é mandril de 13mm. Ele cobre praticamente todas as brocas que você vai usar no dia a dia e evita a frustração de descobrir, já na obra, que a broca não entra no mandril."}, {"type": "heading", "text": "Função impacto, rotação e peso"}, {"type": "paragraph", "text": "A função impacto é o que define a categoria. Ative-a para furar concreto e alvenaria; desative para madeira, metal e para parafusar, onde só a rotação resolve. Confira se o modelo tem o seletor de impacto ligado/desligado, porque furar metal com o impacto ativo estraga a broca e o furo."}, {"type": "paragraph", "text": "A rotação (rpm) influencia o acabamento e a velocidade de furo. Furos grandes pedem rotação menor e mais controle; furos pequenos em metal e madeira aceitam rotação maior. O ideal é ter velocidade variável no gatilho e, de preferência, reversão, que ajuda a soltar broca presa e a remover parafusos."}, {"type": "paragraph", "text": "O peso (em kg) pesa de verdade quando o trabalho é acima da cabeça ou o dia é longo. Uma máquina mais leve cansa menos; uma mais robusta encara serviço bruto com mais estabilidade. Pegue na mão, sinta o equilíbrio e veja se a empunhadura auxiliar é confortável."}, {"type": "list", "items": ["Velocidade variável no gatilho: controle fino do começo do furo.", "Reversão: solta broca travada e remove parafusos.", "Empunhadura auxiliar e limitador de profundidade: mais segurança e furos na medida certa.", "Seletor de impacto independente: liga só quando você precisa, preservando broca e furo."]}, {"type": "heading", "text": "Com fio ou bateria: qual furadeira de impacto comprar"}, {"type": "paragraph", "text": "A furadeira de impacto com fio entrega força constante, não depende de carga e custa menos pelo mesmo nível de potência. É a escolha de quem trabalha sempre perto de tomada e fura concreto e metal o dia todo. O modelo Bosch GSB 13 RE é um exemplo clássico dessa linha: com fio, mandril de 13mm e potência na faixa versátil, atende bem o profissional que precisa de uma máquina confiável para o uso diário."}, {"type": "paragraph", "text": "A versão a bateria troca o cabo pela mobilidade. Faz sentido para quem trabalha em altura, em locais sem energia ou se move muito pela obra. Aqui você passa a olhar a tensão da bateria (V) e a capacidade (Ah): mais volts dão mais torque, mais amperes-hora dão mais autonomia. Vale ter uma bateria reserva e o carregador à mão para não parar o serviço."}, {"type": "list", "items": ["Com fio: força contínua, mais barato por watt, ideal para uso fixo e pesado.", "Bateria: mobilidade total, melhor para altura e locais sem tomada; atenção à tensão (V), à capacidade (Ah) e ao carregador.", "Tem os dois perfis de uso? Considere ter uma com fio para o serviço bruto e uma parafusadeira a bateria para montagem e fixação."]}, {"type": "heading", "text": "Recomendações por tipo de uso"}, {"type": "list", "items": ["Reparos domésticos e ocasionais: até 550W, mandril de 10mm, com fio. Resolve quadro na parede, drywall e furos leves.", "Profissional do dia a dia (construção, manutenção, elétrica): 550W a 700W, mandril de 13mm, com fio, velocidade variável e reversão. Perfil da Bosch GSB 13 RE.", "Uso pesado e contínuo (concreto estrutural, brocas grandes): acima de 700W, mandril de 13mm, empunhadura auxiliar firme.", "Trabalho em altura ou sem tomada: versão a bateria com boa tensão (V) e bateria reserva.", "Quem só parafusa muito: avalie uma parafusadeira a bateria; o impacto da furadeira é desnecessário para fixação."]}, {"type": "paragraph", "text": "Marcas profissionais como Bosch, DeWalt, Makita, Vonder e Einhell cobrem todas essas faixas. A diferença está nos detalhes de construção, na garantia e na assistência. Escolha a faixa de potência e o mandril certos primeiro; depois compare modelos dentro dela."}, {"type": "heading", "text": "Onde comprar furadeira de impacto em Natal/RN"}, {"type": "paragraph", "text": "Na Natalmaq você encontra furadeiras de impacto das principais marcas, com fio e a bateria, em diferentes faixas de potência e mandril, além de brocas e acessórios para acompanhar. A compra é com nota fiscal e CNPJ para empresas, com atendimento técnico para você fechar o modelo certo sem erro."}, {"type": "paragraph", "text": "Monte seu orçamento pelo catálogo, separe os modelos que se encaixam no seu uso e fale com a equipe no WhatsApp para tirar dúvidas e finalizar o pedido. Se ficar na dúvida entre potência, mandril ou fio x bateria, é só consultar o orçamento que a gente ajuda a decidir."}]$json$::jsonb,
  (select id from clusters where slug = $txt$furadeira-de-impacto-e-parafusadeira$txt$),
  false,
  $txt$Furadeira de impacto: como escolher (guia)$txt$,
  $txt$Como escolher furadeira de impacto: potência (W), mandril 10 ou 13mm, função impacto, com fio x bateria e dicas por uso. Guia de compra da Natalmaq em Natal/RN.$txt$,
  array[
      $kw$furadeira de impacto$kw$,
      $kw$furadeira impacto profissional$kw$,
      $kw$mandril furadeira$kw$,
      $kw$como escolher furadeira de impacto$kw$,
      $kw$furadeira de impacto potência$kw$,
      $kw$furadeira de impacto com fio ou bateria$kw$,
      $kw$Bosch GSB 13 RE$kw$,
      $kw$mandril 10mm ou 13mm$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  6,
  $json$[{"pergunta": "Que potência de furadeira de impacto escolher?", "resposta": "Para uso doméstico, até 550W resolve. Para o profissional do dia a dia, fique entre 550W e 700W. Para uso pesado e contínuo em concreto, prefira acima de 700W."}, {"pergunta": "Mandril de 10mm ou 13mm: qual é melhor?", "resposta": "O de 13mm aceita brocas mais grossas e é o padrão profissional. O de 10mm serve para furos finos e médios e costuma vir em modelos mais leves e compactos."}, {"pergunta": "Furadeira de impacto com fio ou a bateria?", "resposta": "Com fio entrega força constante e custa menos por watt, ideal para uso fixo e pesado. A bateria dá mobilidade e vale para trabalho em altura ou locais sem tomada."}, {"pergunta": "A Bosch GSB 13 RE é boa para profissional?", "resposta": "Sim. Ela é com fio, tem mandril de 13mm e potência na faixa versátil, atendendo bem quem fura alvenaria, concreto leve e metal no dia a dia."}, {"pergunta": "Posso parafusar com a furadeira de impacto?", "resposta": "Dá, desativando a função impacto. Mas se você parafusa muito, uma parafusadeira a bateria é mais leve, ágil e precisa para fixação."}]$json$::jsonb,
  $json${"nome": "Como escolher uma furadeira de impacto", "passos": [{"nome": "Defina o uso", "texto": "Decida o que você vai furar com mais frequência (madeira, metal, alvenaria, concreto) e se o uso é ocasional, diário ou pesado. Isso orienta todas as escolhas seguintes."}, {"nome": "Escolha a potência (W)", "texto": "Até 550W para reparos leves, 550W a 700W para o profissional do dia a dia e acima de 700W para concreto estrutural e uso contínuo."}, {"nome": "Defina o mandril", "texto": "Prefira mandril de 13mm para uso profissional, pois aceita brocas mais grossas. O de 10mm basta para furos finos e médios."}, {"nome": "Decida com fio ou bateria", "texto": "Com fio para força constante e uso fixo. A bateria para mobilidade, altura e locais sem tomada, olhando tensão (V) e capacidade (Ah)."}, {"nome": "Escolha a marca e o modelo", "texto": "Dentro da faixa definida, compare modelos de marcas profissionais (Bosch, DeWalt, Makita, Vonder, Einhell). A Bosch GSB 13 RE é uma referência para uso diário com fio."}]}$json$::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: comprar-ferramentas-com-cnpj-vantagens  (cluster comprar-ferramentas-cnpj, reading_time=5)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$comprar-ferramentas-com-cnpj-vantagens$txt$,
  $txt$Comprar ferramentas com CNPJ: vantagens e como funciona$txt$,
  $txt$B2B$txt$,
  $txt$Comprar ferramentas com CNPJ rende nota fiscal, crédito de ICMS, faturamento e garantia para a empresa. Veja as vantagens da compra B2B e como funciona na prática.$txt$,
  $json$[{"type": "paragraph", "text": "Comprar ferramentas com CNPJ é a forma certa de a sua empresa adquirir máquinas, equipamentos e EPI: você recebe nota fiscal no nome da pessoa jurídica, pode aproveitar crédito de ICMS, lança o gasto na contabilidade e ainda garante a cobertura de garantia para uso profissional. Na prática, é a diferença entre uma compra que vira documento contábil e uma compra avulsa que some na hora do balanço."}, {"type": "paragraph", "text": "Neste guia você vai entender as vantagens fiscais e operacionais de comprar como PJ, o que muda em relação à compra como pessoa física e como funciona o passo a passo da compra B2B. Use como referência antes de fechar o próximo orçamento da sua equipe."}, {"type": "heading", "text": "Por que comprar ferramentas com CNPJ vale a pena"}, {"type": "paragraph", "text": "Comprar ferramentas com CNPJ deixa de ser só uma formalidade quando você soma os ganhos. A nota fiscal no nome da empresa transforma cada compra em um ativo rastreável, dedutível e protegido por garantia comercial. Para quem trabalha com construção, indústria, marcenaria, elétrica ou manutenção, isso pesa no caixa e na organização."}, {"type": "list", "items": ["Nota fiscal no CNPJ: comprovação legal da compra, base para garantia, seguro e prestação de contas", "Crédito de ICMS: empresas no regime normal (lucro real ou presumido) podem aproveitar o imposto destacado na NF de entrada conforme a legislação", "Dedução de despesa: a aquisição entra como custo ou despesa operacional na contabilidade, reduzindo a base de cálculo de tributos", "Faturamento e controle de fluxo de caixa: a compra fica registrada para conferência financeira e auditoria", "Garantia PJ: cobertura comercial pensada para o uso profissional e intenso, diferente do uso doméstico", "Organização de patrimônio: ferramentas de maior valor entram no controle de ativos da empresa"]}, {"type": "heading", "text": "Nota fiscal e crédito de ICMS: o que muda no imposto"}, {"type": "paragraph", "text": "A nota fiscal é o documento central da compra B2B. Sem ela, a empresa não comprova a despesa nem aciona garantia, e o produto fica fora da contabilidade. Com a NF emitida no CNPJ, você guarda o histórico de tudo que entrou e a que custo."}, {"type": "paragraph", "text": "O crédito de ICMS é a vantagem que mais gera dúvida. De forma simples: empresas tributadas pelo lucro real ou presumido podem, em geral, se creditar do ICMS destacado na nota de entrada e abater no imposto a recolher, dentro das regras de cada estado. Quem é optante do Simples Nacional segue uma sistemática diferente e normalmente não aproveita esse crédito da mesma maneira."}, {"type": "paragraph", "text": "Cada regime tem suas regras, então confirme com a sua contabilidade como o crédito se aplica ao seu caso. O que vale para todos é a regra de ouro: peça sempre a NF no CNPJ correto para manter o direito ao crédito e à dedução."}, {"type": "heading", "text": "Garantia PJ e suporte técnico para uso profissional"}, {"type": "paragraph", "text": "Ferramenta de empresa trabalha mais horas, em ambiente mais pesado, do que ferramenta de uso doméstico. Por isso a compra com CNPJ costuma vir acompanhada de garantia adequada ao uso profissional e de suporte para acionar a assistência quando algo falha."}, {"type": "paragraph", "text": "Com a nota fiscal em mãos, acionar garantia de uma furadeira Bosch, de uma esmerilhadeira Makita ou de uma serra DeWalt fica direto: a NF prova a data da compra e o modelo. Para itens de proteção, a compra como PJ ajuda a manter o controle de validade e do Certificado de Aprovação (CA) exigido pela NR-6 nos EPI da equipe, como capacete, luva, óculos, bota, protetor auricular e máscara."}, {"type": "heading", "text": "Compra recorrente e reposição de estoque"}, {"type": "paragraph", "text": "Empresa não compra só uma vez. Quem mantém equipe em campo repõe broca, disco, ponta de parafusadeira, abrasivo Norton, eletrodo Esab e EPI o tempo todo. Comprar com CNPJ organiza essa recorrência: cada reposição vira nota, entra no controle de custo por obra ou por setor e facilita planejar o próximo pedido."}, {"type": "list", "items": ["Padronize as marcas e modelos que a equipe já usa para acelerar a reposição", "Mantenha um estoque mínimo de consumíveis (discos, brocas, pontas, luvas) para não parar a obra", "Registre cada compra no CNPJ para acompanhar o custo real de ferramenta por projeto", "Concentre o fornecimento em um fornecedor que atenda PJ com nota fiscal e estoque local"]}, {"type": "heading", "text": "Como funciona a compra com CNPJ na Natalmaq"}, {"type": "paragraph", "text": "Na Natalmaq, comprar ferramentas com CNPJ é simples e feito pelo WhatsApp. Você monta a cesta de produtos pelo catálogo, com mais de 11 mil itens ativos de marcas como Bosch, DeWalt, Makita, Vonder, Tramontina e 3M, e envia o pedido para a nossa equipe."}, {"type": "list", "items": ["Monte o orçamento navegando pelo catálogo e selecionando os produtos da sua equipe", "Informe o CNPJ da empresa no WhatsApp para o pedido sair com nota fiscal correta", "Receba o orçamento com NF e confirme as condições com a equipe", "Aprove e combine a entrega em todo o RN ou a retirada na loja em Natal"]}, {"type": "paragraph", "text": "Atendemos profissionais e empresas em todo o Rio Grande do Norte, com nota fiscal, compra no CNPJ e orientação técnica antes de fechar. Se a sua intenção é fornecimento contínuo para a equipe, conheça a página de compra B2B para empresas em Natal/RN e veja as condições para pedidos recorrentes."}, {"type": "paragraph", "text": "Monte o seu orçamento pelo catálogo e fale com a equipe da Natalmaq no WhatsApp. Informe o CNPJ da empresa e receba o pedido com nota fiscal, pronto para entrega no RN ou retirada na loja."}]$json$::jsonb,
  (select id from clusters where slug = $txt$comprar-ferramentas-cnpj$txt$),
  false,
  $txt$Comprar Ferramentas com CNPJ: Vantagens B2B$txt$,
  $txt$Comprar ferramentas com CNPJ traz nota fiscal, crédito de ICMS, faturamento e garantia PJ. Veja as vantagens e como funciona a compra B2B em Natal/RN.$txt$,
  array[
      $kw$comprar ferramentas com cnpj$kw$,
      $kw$nota fiscal ferramentas empresa$kw$,
      $kw$compra b2b$kw$,
      $kw$compra b2b ferramentas$kw$,
      $kw$ferramentas com cnpj$kw$,
      $kw$crédito de icms ferramentas$kw$,
      $kw$faturamento ferramentas empresa$kw$,
      $kw$nota fiscal cnpj$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  5,
  $json$[{"pergunta": "Posso comprar ferramentas com CNPJ na Natalmaq?", "resposta": "Sim. Atendemos empresas e profissionais com compra no CNPJ e nota fiscal, em todo o Rio Grande do Norte. Basta montar o orçamento pelo catálogo e informar o CNPJ no WhatsApp."}, {"pergunta": "A nota fiscal sai no nome da empresa?", "resposta": "Sim. A NF é emitida no CNPJ informado no pedido, com os produtos e valores destacados. É esse documento que garante a dedução da despesa, o crédito de imposto quando aplicável e o acionamento de garantia."}, {"pergunta": "Comprar com CNPJ dá direito a crédito de ICMS?", "resposta": "Depende do regime tributário. Empresas no lucro real ou presumido podem, em geral, aproveitar o ICMS destacado na nota de entrada conforme a legislação do estado. Optantes do Simples seguem regra diferente. Confirme com a sua contabilidade."}, {"pergunta": "A garantia muda quando compro como pessoa jurídica?", "resposta": "A garantia continua valendo e a nota fiscal é o que comprova a data e o modelo na hora de acionar a assistência. As ferramentas profissionais vêm com cobertura adequada ao uso intenso da empresa."}, {"pergunta": "Como faço para repor o estoque da minha equipe?", "resposta": "Você refaz o orçamento pelo catálogo com os itens que precisa repor e envia no WhatsApp com o CNPJ. Cada compra sai com nota fiscal, o que facilita o controle de custo e o planejamento da próxima reposição."}]$json$::jsonb,
  null::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: bosch-ou-dewalt-profissional  (cluster bosch-makita-dewalt-profissional, reading_time=5)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$bosch-ou-dewalt-profissional$txt$,
  $txt$Bosch ou DeWalt para uso profissional: qual escolher$txt$,
  $txt$Comparativo$txt$,
  $txt$DeWalt ou Bosch profissional? Comparamos potência, durabilidade, garantia, assistência e preço da linha azul Bosch e da DeWalt para você decidir qual marca leva, sem achismo.$txt$,
  $json$[{"type": "paragraph", "text": "Na hora de escolher entre DeWalt ou Bosch profissional, a resposta curta é: as duas estão no topo do mercado e ambas duram. A diferença que importa para você está nos detalhes, na linha de produto que cada uma cobre melhor, na rede de assistência e no preço do conjunto (ferramenta, bateria e acessório). Este comparativo vai direto ao ponto para você decidir qual marca leva."}, {"type": "paragraph", "text": "Antes de tudo, um aviso para não cair em armadilha: tanto a Bosch quanto a DeWalt têm linha profissional e linha mais leve. Na Bosch, a profissional é a famosa linha azul (Professional). A linha verde é doméstica, feita para reforma esporádica, não para canteiro. Comparar a Bosch verde com a DeWalt é injusto. O comparativo justo é DeWalt contra Bosch azul, e é nesse pé que tratamos a marca aqui."}, {"type": "heading", "text": "Potência e desempenho no trabalho"}, {"type": "paragraph", "text": "Em potência bruta e torque, DeWalt e Bosch azul caminham lado a lado nas mesmas faixas. Uma furadeira de impacto profissional das duas marcas entrega de 700 a 900 W na versão com fio, e os modelos a bateria de 18V/20V já têm motor brushless (sem escovas), que rende mais força com menos aquecimento e bateria que dura mais por carga."}, {"type": "paragraph", "text": "Na prática, ninguém ganha por uma margem que você sinta no dia a dia. O que pesa é casar a ferramenta com o serviço. A DeWalt costuma ser elogiada em ferramentas de corte e construção pesada, como serra circular e serra de esquadria. A Bosch azul tem fama em furação, perfuração com SDS e parafusadeiras, além de excelente eletrônica de controle de rotação."}, {"type": "heading", "text": "Durabilidade e construção"}, {"type": "paragraph", "text": "Durabilidade é onde a linha profissional justifica o preço. Tanto a DeWalt quanto a Bosch azul são projetadas para ciclo de trabalho pesado, ou seja, uso contínuo durante o expediente, e não furos esporádicos no fim de semana. Carcaça reforçada, rolamentos melhores, vedação contra poeira e motor brushless são o padrão nas duas."}, {"type": "paragraph", "text": "O que mais derruba uma ferramenta profissional na vida real não é o motor, é o descuido: poeira entupindo a ventilação, queda, bateria maltratada. Com manutenção simples, as duas marcas passam tranquilas dos cinco anos de uso intenso. Se durabilidade é seu critério número um, fique de olho menos na marca e mais em comprar a linha profissional certa (azul, no caso da Bosch) e cuidar do equipamento."}, {"type": "heading", "text": "Garantia e assistência técnica"}, {"type": "paragraph", "text": "Aqui mora um ponto decisivo para quem trabalha com a ferramenta: garantia só vale se houver assistência perto de você. Ferramenta profissional para de funcionar no pior momento, e ficar semanas sem ela custa serviço perdido. Por isso, mais do que o prazo no papel, avalie onde você conserta e quão rápido."}, {"type": "list", "items": ["Confira se a garantia cobre a ferramenta e a bateria (que costuma ter prazo próprio e menor)", "Verifique a assistência autorizada da marca na sua região antes de comprar", "Pergunte sobre tempo médio de reparo e disponibilidade de peças", "Guarde a nota fiscal: sem ela, a garantia de fábrica não corre, e na compra com CNPJ a NF é automática"]}, {"type": "paragraph", "text": "Bosch e DeWalt têm rede ampla no Brasil. Na Natalmaq, além de vender as duas marcas com nota fiscal, contamos com assistência técnica em galpão próprio para furadeiras e parafusadeiras, o que encurta o tempo que você fica sem a ferramenta. Esse é um diferencial que o preço de tabela não mostra."}, {"type": "heading", "text": "Preço e custo do ecossistema de bateria"}, {"type": "paragraph", "text": "Olhar só o preço da ferramenta avulsa engana. O custo de verdade está no ecossistema: cada marca tem seu padrão de bateria, e bateria não é compatível entre Bosch e DeWalt. Quando você compra a primeira ferramenta a bateria, está escolhendo a plataforma que vai usar nos próximos anos."}, {"type": "paragraph", "text": "A dica de ouro é padronizar. Se a sua equipe já tem várias baterias de uma marca, comprar a próxima ferramenta da mesma família sai mais barato (muitos modelos vendem na versão sem bateria, a chamada body only) e simplifica a logística no canteiro. Trocar de marca a cada compra é o caminho mais caro: você acumula carregadores e baterias que não conversam entre si."}, {"type": "list", "items": ["DeWalt: plataforma 18V/20V XR, forte em construção pesada e corte de madeira", "Bosch azul (Professional): plataforma 18V, forte em furação, perfuração SDS e parafusamento", "Em valor de tabela, as duas competem na mesma faixa profissional; promoções e kit com bateria fazem mais diferença que a marca", "Não misture: compare sempre o preço do kit completo (ferramenta + bateria + carregador), não só o corpo da ferramenta"]}, {"type": "heading", "text": "Quando escolher Bosch e quando escolher DeWalt"}, {"type": "paragraph", "text": "Resumindo o comparativo de DeWalt ou Bosch profissional em recomendações práticas, por perfil de uso:"}, {"type": "list", "items": ["Escolha Bosch azul se o seu forte é furação, perfuração em concreto com SDS, parafusamento e serviços de elétrica e instalação que pedem controle fino de rotação", "Escolha DeWalt se você faz muito corte e construção pesada: serra circular, serra de esquadria, marcenaria e obra que exige robustez de corte", "Já tem baterias de uma das marcas? Continue nela: padronizar a plataforma vale mais que qualquer diferença pontual de modelo", "Está montando o kit do zero? Escolha pela assistência mais próxima e pelo melhor preço do conjunto com bateria no momento da compra"]}, {"type": "paragraph", "text": "Não existe marca errada entre as duas para quem é profissional. Existe a escolha certa para o seu tipo de serviço e para o que já está na sua maleta. Se ainda estiver na dúvida, a melhor decisão é conversar com quem vende as duas e conhece o uso real, em vez de comparar só ficha técnica na internet."}, {"type": "heading", "text": "Onde comprar Bosch e DeWalt em Natal/RN"}, {"type": "paragraph", "text": "Na Natalmaq você encontra a linha profissional da Bosch e da DeWalt, com nota fiscal e compra com CNPJ para a sua empresa, além de assistência técnica para manter a ferramenta no ar. Monte o seu orçamento pelo catálogo e fale com a nossa equipe no WhatsApp: a gente compara os modelos com você, considera as baterias que você já tem e indica o melhor conjunto para o seu trabalho."}]$json$::jsonb,
  (select id from clusters where slug = $txt$bosch-makita-dewalt-profissional$txt$),
  false,
  $txt$DeWalt ou Bosch Profissional: Qual Escolher$txt$,
  $txt$DeWalt ou Bosch profissional: compare potência, durabilidade, garantia, assistência e preço para escolher a melhor marca de ferramenta para o seu trabalho.$txt$,
  array[
      $kw$dewalt ou bosch profissional$kw$,
      $kw$bosch vs dewalt$kw$,
      $kw$melhor marca ferramenta$kw$,
      $kw$bosch ou dewalt$kw$,
      $kw$linha azul bosch profissional$kw$,
      $kw$ferramenta profissional bosch dewalt$kw$,
      $kw$comparativo bosch dewalt$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  5,
  $json$[{"pergunta": "Bosch ou DeWalt: qual é a melhor para uso profissional?", "resposta": "As duas estão no topo e são equivalentes em qualidade. A Bosch azul (Professional) se destaca em furação e parafusamento; a DeWalt, em corte e construção pesada. Escolha pelo tipo de serviço e pela bateria que você já usa."}, {"pergunta": "A linha azul da Bosch é a profissional?", "resposta": "Sim. Na Bosch, a linha azul (Professional) é a feita para uso intenso e profissional. A linha verde é doméstica, indicada para reforma esporádica, e não deve ser comparada com a DeWalt."}, {"pergunta": "As baterias da Bosch e da DeWalt são compatíveis entre si?", "resposta": "Não. Cada marca tem seu próprio padrão de bateria e carregador. Por isso vale padronizar a plataforma: comprar a próxima ferramenta da mesma marca das baterias que você já tem sai mais barato."}, {"pergunta": "Qual marca tem melhor garantia e assistência?", "resposta": "Bosch e DeWalt têm rede ampla no Brasil. O que mais importa é a assistência perto de você e o tempo de reparo. Guarde sempre a nota fiscal, pois sem ela a garantia de fábrica não vale."}, {"pergunta": "Bosch e DeWalt têm preços muito diferentes?", "resposta": "Não. Na linha profissional, as duas competem na mesma faixa. O que muda o custo é o conjunto (ferramenta, bateria e carregador) e as promoções. Compare sempre o kit completo, não só o corpo da ferramenta."}]$json$::jsonb,
  null::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: serra-circular-dewalt-ou-bosch-corte-madeira  (cluster serra-circular-marcenaria, reading_time=5)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$serra-circular-dewalt-ou-bosch-corte-madeira$txt$,
  $txt$Serra circular DeWalt ou Bosch para corte de madeira$txt$,
  $txt$Comparativo$txt$,
  $txt$Serra circular DeWalt ou Bosch para corte de madeira: comparamos potência, disco de 184mm, profundidade, base e peso para você decidir. A DeWalt DWE560 puxa no corte profissional; a Bosch entrega versatilidade e custo-benefício.$txt$,
  $json$[{"type": "paragraph", "text": "Entre serra circular DeWalt ou Bosch para corte de madeira, a resposta direta é: escolha DeWalt (modelo DWE560) quando o corte profissional intenso e a precisão na linha mandam, e escolha Bosch quando você quer versatilidade, ótima base de apoio e melhor custo-benefício no dia a dia. As duas usam disco de 184mm, cortam até cerca de 65mm de profundidade a 90 graus e ficam na faixa de 1.350 a 1.400W, então a decisão pesa mais no acabamento, no peso e no tipo de serviço que você faz."}, {"type": "paragraph", "text": "Neste comparativo você vê lado a lado potência, profundidade de corte, base, peso e disco das duas marcas, com foco em quem corta madeira de verdade. No fim, fica claro qual leva para a sua bancada e como montar o orçamento com a equipe da Natalmaq."}, {"type": "heading", "text": "Serra circular DeWalt ou Bosch: comparativo direto"}, {"type": "paragraph", "text": "Olhando os modelos de 184mm que dominam a marcenaria, as diferenças técnicas são pequenas no papel e grandes na mão. Resumimos os pontos que mais influenciam o corte de madeira:"}, {"type": "list", "items": ["Potência: ambas trabalham entre 1.350W e 1.400W, força de sobra para madeira maciça, MDF e compensado", "Disco: padrão de 184mm (7.1/4 polegadas) nas duas, o tipo mais fácil de encontrar e repor", "Profundidade de corte: gira em torno de 65mm a 90 graus e 45mm a 45 graus, suficiente para a maioria das tábuas e chapas", "Rotação: em torno de 5.000 rpm, o que garante corte limpo em alta velocidade", "Peso: a DeWalt DWE560 fica perto de 3,7 kg, leve para o uso prolongado; modelos Bosch da mesma faixa ficam próximos disso", "Base: chapa de alumínio robusta nas duas, com ajuste de ângulo e de profundidade por alavanca"]}, {"type": "paragraph", "text": "Na prática, a DeWalt costuma agradar quem busca corte reto e firme com o gatilho respondendo rápido. A Bosch ganha pontos na estabilidade da base e na facilidade de seguir a guia, o que ajuda muito quem faz móveis sob medida."}, {"type": "heading", "text": "DeWalt DWE560: a serra circular para corte de madeira mais pedida"}, {"type": "paragraph", "text": "A DeWalt DWE560 é a referência de serra circular para corte de madeira no segmento profissional. Ela usa disco de 184mm, motor de cerca de 1.350W e entrega profundidade de corte em torno de 65mm a 90 graus, o que cobre desde sarrafos até chapas grossas de compensado sem forçar o motor."}, {"type": "paragraph", "text": "O peso baixo, próximo de 3,7 kg, faz diferença em jornada longa de marcenaria: menos cansaço no braço significa corte mais preciso no fim do dia. A base de alumínio com indicador de linha de corte ajuda a seguir o risco com segurança, e o ajuste de bisel até 45 graus resolve cortes em ângulo sem complicação."}, {"type": "list", "items": ["Disco de 184mm, fácil de repor e compatível com discos para madeira de 24 a 60 dentes", "Potência em torno de 1.350W, com torque firme em madeira maciça", "Profundidade de corte de cerca de 65mm (90 graus) e 45mm (45 graus)", "Peso aproximado de 3,7 kg, leve para uso contínuo", "Base de alumínio com guia de linha de corte para seguir o risco"]}, {"type": "paragraph", "text": "Se o seu trabalho é cortar madeira o dia inteiro com acabamento limpo, a DWE560 é a escolha segura. Ela está no catálogo da Natalmaq e você confere as especificações completas na página do produto serra-circular-dewalt-dwe560."}, {"type": "heading", "text": "Quando a Bosch leva vantagem no corte de madeira"}, {"type": "paragraph", "text": "A Bosch é forte quando você precisa de uma ferramenta versátil que corta madeira bem e ainda quebra um galho em outros materiais com o disco certo. Os modelos de 184mm da marca trazem base estável, bom sistema de ajuste e a confiabilidade que faz a linha azul Bosch ser referência em obra e marcenaria."}, {"type": "paragraph", "text": "Para quem está montando o kit ou divide a serra entre serviços variados, a Bosch costuma sair com melhor relação entre preço e recursos. Ela também tem rede de assistência ampla, o que conta na hora de manter a ferramenta rodando por anos."}, {"type": "list", "items": ["Base bem dimensionada, que facilita seguir guia e trilho", "Boa relação custo-benefício para uso geral em madeira e chapas", "Disco de 184mm padrão, com troca rápida", "Confiabilidade da linha azul Bosch e rede de assistência consolidada"]}, {"type": "heading", "text": "O disco importa tanto quanto a marca"}, {"type": "paragraph", "text": "Na serra circular, o disco define o acabamento mais do que a marca da máquina. Para corte de madeira, o número de dentes muda o resultado: quanto mais dentes, mais fino e limpo é o corte; quanto menos dentes, mais rápido e bruto."}, {"type": "list", "items": ["Disco de 18 a 24 dentes: corte rápido e bruto, ideal para desbaste e madeira de obra", "Disco de 40 dentes: equilíbrio entre velocidade e acabamento, bom para uso geral", "Disco de 60 dentes ou mais: corte fino e limpo em MDF, compensado e laminados, o preferido da marcenaria", "Sempre confira o diâmetro de 184mm e o furo central compatível com a sua serra"]}, {"type": "paragraph", "text": "Disco cego força o motor, queima a madeira e estraga o acabamento. Vale ter pelo menos dois discos: um de poucos dentes para corte rápido e um de muitos dentes para o acabamento fino. A Natalmaq tem disco para serra circular de 184mm de marcas como Bosch e Norton no catálogo."}, {"type": "heading", "text": "Qual escolher: DeWalt ou Bosch para a sua marcenaria"}, {"type": "paragraph", "text": "Resumindo a decisão: se você corta madeira em ritmo profissional e quer leveza, precisão e gatilho responsivo, a DeWalt DWE560 é a aposta certeira. Se você busca uma serra versátil, com base estável e melhor custo-benefício para serviços variados, a Bosch entrega muito bem."}, {"type": "paragraph", "text": "Use sempre óculos de proteção e protetor auricular no corte, e respeite a NR-12 quanto à proteção do disco e ao uso correto da máquina. Independente da marca, uma serra bem regulada com o disco certo faz o corte limpo que a marcenaria exige."}, {"type": "paragraph", "text": "Na dúvida entre DeWalt ou Bosch, fale com a equipe da Natalmaq. Monte o orçamento pelo catálogo, peça a recomendação para o seu tipo de serviço e feche pelo WhatsApp com nota fiscal e compra no CNPJ, com entrega em todo o RN."}]$json$::jsonb,
  (select id from clusters where slug = $txt$serra-circular-marcenaria$txt$),
  false,
  $txt$Serra Circular DeWalt ou Bosch para Corte de Madeira$txt$,
  $txt$Serra circular DeWalt ou Bosch para corte de madeira: compare potência, disco 184mm, profundidade de corte, base e peso. Veja qual escolher e feche pelo WhatsApp.$txt$,
  array[
      $kw$serra circular dewalt ou bosch$kw$,
      $kw$serra circular corte madeira$kw$,
      $kw$melhor serra circular marceneiro$kw$,
      $kw$serra circular dewalt dwe560$kw$,
      $kw$serra circular 184mm$kw$,
      $kw$serra circular profissional$kw$,
      $kw$disco serra circular madeira$kw$,
      $kw$profundidade de corte serra circular$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  5,
  $json$[{"pergunta": "Serra circular DeWalt ou Bosch é melhor para corte de madeira?", "resposta": "Para corte profissional intenso e preciso, a DeWalt DWE560 leva vantagem pela leveza e resposta. Para versatilidade e custo-benefício no uso geral, a Bosch é excelente. Ambas usam disco de 184mm."}, {"pergunta": "Qual disco usar na serra circular para cortar madeira?", "resposta": "Use disco de 184mm com 18 a 24 dentes para corte rápido e bruto, 40 dentes para uso geral e 60 dentes ou mais para acabamento fino em MDF e compensado."}, {"pergunta": "Qual serra circular corta mais fundo, DeWalt ou Bosch?", "resposta": "Nos modelos de 184mm das duas marcas a profundidade é parecida, em torno de 65mm a 90 graus e 45mm a 45 graus. A diferença real está no acabamento, no peso e na base."}, {"pergunta": "A DeWalt DWE560 é leve para uso prolongado?", "resposta": "Sim. A DWE560 pesa cerca de 3,7 kg, o que reduz o cansaço em jornadas longas de marcenaria e ajuda a manter o corte preciso até o fim do dia."}, {"pergunta": "Onde comprar serra circular DeWalt ou Bosch em Natal com nota fiscal?", "resposta": "Na Natalmaq você encontra serra circular DeWalt e Bosch no catálogo, com nota fiscal, compra no CNPJ e entrega em todo o RN. Monte o orçamento e feche pelo WhatsApp."}]$json$::jsonb,
  null::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- Artigo: como-escolher-fornecedor-de-ferramentas-rn  (cluster fornecedor-industrial-rn, reading_time=5)
insert into artigos (
  slug, titulo, categoria_label, excerpt, corpo, cluster_id, eh_pilar,
  meta_title, meta_description, keywords, status, published_at, autor_nome,
  reading_time, faq, howto, ordem
) values (
  $txt$como-escolher-fornecedor-de-ferramentas-rn$txt$,
  $txt$Como escolher um fornecedor de ferramentas no RN$txt$,
  $txt$B2B$txt$,
  $txt$Escolher um bom fornecedor de ferramentas no RN é o que mantém sua obra ou produção rodando sem parada. Veja os 6 critérios que separam um distribuidor confiável de uma loja qualquer: estoque, nota fiscal, prazo, suporte e cobertura no interior.$txt$,
  $json$[{"type": "paragraph", "text": "Escolher um fornecedor de ferramentas no RN não é só procurar o menor preço. O fornecedor certo é aquele que tem o item em estoque na hora que você precisa, emite nota fiscal, entrega no prazo e dá suporte técnico antes e depois da compra. Para uma empresa de construção, indústria, marcenaria, elétrica ou manutenção, parar a equipe esperando uma ferramenta custa muito mais caro do que a diferença de centavos no orçamento."}, {"type": "paragraph", "text": "Neste guia você vai ver os critérios que separam um distribuidor de ferramentas confiável de uma loja qualquer. Use como checklist na hora de fechar com um novo fornecedor ou de revisar o atual, principalmente se sua empresa compra com CNPJ e precisa de reposição recorrente em Natal e no interior do estado."}, {"type": "heading", "text": "Por que a escolha do fornecedor de ferramentas RN faz diferença"}, {"type": "paragraph", "text": "Quem trabalha com ferramenta sabe que o problema raramente é comprar uma vez. O problema é manter o canteiro, a oficina ou a linha de produção abastecida sem surpresa. Um disco que acabou, uma broca que quebrou ou uma esmerilhadeira que parou no meio do serviço travam a equipe inteira."}, {"type": "paragraph", "text": "Por isso o fornecedor de ferramentas RN ideal funciona como parceiro, não como balcão. Ele conhece o que você usa, tem marcas profissionais de verdade no catálogo (Bosch, DeWalt, Makita, Vonder, Tramontina, entre outras) e resolve o pedido com agilidade. Avaliar os critérios abaixo evita o retrabalho de trocar de fornecedor toda vez que falta um item."}, {"type": "heading", "text": "Variedade e estoque: o fornecedor tem o que você precisa?"}, {"type": "paragraph", "text": "O primeiro critério é a profundidade do catálogo. Um bom distribuidor cobre não só a ferramenta elétrica, mas também os acessórios e o consumível que fazem o serviço andar. De nada adianta achar a furadeira se faltar a broca, o disco ou a ponta de parafusadeira na mesma compra."}, {"type": "list", "items": ["Ferramentas elétricas: furadeira, parafusadeira, esmerilhadeira, lixadeira e perfurador", "Ferramentas manuais: alicate, chave, martelo, marreta, nível e trena", "Consumíveis e acessórios: disco, broca, abrasivos Norton e baterias com carregador", "EPI completo: capacete, luva, óculos, bota, protetor auricular e máscara respiratória", "Solda e corte: equipamentos e insumos Esab, Lincoln e Boxer"]}, {"type": "paragraph", "text": "Repare também no estoque local. Catálogo grande no site não vale nada se o item vem de fora a cada pedido. Um fornecedor com estoque físico em Natal entrega mais rápido e raramente deixa você na mão por falta de produto. Quanto mais SKUs ativos e mais marcas reais, maior a chance de você resolver tudo em um só lugar."}, {"type": "heading", "text": "Nota fiscal e atendimento B2B com CNPJ"}, {"type": "paragraph", "text": "Para empresa, comprar com nota fiscal não é opcional. A NF garante a garantia do fabricante, permite o lançamento contábil da despesa e, dependendo do regime, o aproveitamento de crédito de ICMS. Fornecedor que não emite nota fiscal cheia não atende quem trabalha sério com CNPJ."}, {"type": "paragraph", "text": "Confirme se o fornecedor está estruturado para o atendimento B2B: compra com CNPJ, condições para pedido em volume, reposição recorrente e suporte para cotação de lista grande. Esse tipo de atendimento reduz o tempo gasto pelo seu setor de compras e padroniza o que entra na empresa."}, {"type": "heading", "text": "Prazo de entrega e cobertura no interior do RN"}, {"type": "paragraph", "text": "Prazo é o critério que mais impacta a obra. Pergunte sempre como funciona a logística antes de fechar: qual o prazo médio em Natal, na Grande Natal e nas cidades do interior como Mossoró, Parnamirim, Caicó ou Currais Novos. Um fornecedor sério informa isso de forma clara e cumpre o combinado."}, {"type": "paragraph", "text": "A cobertura geográfica importa porque obra e indústria não ficam só na capital. O fornecedor que entrega em todo o RN economiza o frete e o tempo de quem está no interior, e dá a opção de retirar na loja em Natal quando a urgência é maior. Confirme se há entrega no seu município e se existe a alternativa de retirada."}, {"type": "heading", "text": "Suporte técnico antes e depois da compra"}, {"type": "paragraph", "text": "Comprar a ferramenta certa exige orientação. Um vendedor que entende de produto te ajuda a escolher entre uma furadeira de impacto e uma parafusadeira, indica a potência em watts adequada ao serviço, o disco certo para o material e o EPI exigido pela norma, seja a NR-6 para proteção individual ou a NR-12 para máquinas."}, {"type": "paragraph", "text": "O suporte também conta no pós-venda. Verifique se o fornecedor tem assistência técnica para as principais marcas e como funciona a garantia. Ter quem resolva um defeito ou um conserto perto de você evita a ferramenta parada por semanas esperando reparo de outro estado."}, {"type": "heading", "text": "Checklist rápido para avaliar o fornecedor"}, {"type": "list", "items": ["Tem estoque local e variedade real de marcas profissionais", "Emite nota fiscal e atende empresas com CNPJ", "Informa o prazo de entrega com clareza e entrega no interior do RN", "Oferece a opção de retirar na loja em Natal", "Dá suporte técnico na escolha e tem assistência no pós-venda", "Resolve pedido em volume e reposição recorrente sem burocracia"]}, {"type": "heading", "text": "A Natalmaq como fornecedor de ferramentas no RN"}, {"type": "paragraph", "text": "A Natalmaq atende profissionais e empresas de construção, indústria, marcenaria, elétrica e manutenção em todo o Rio Grande do Norte. São mais de 11 mil produtos ativos de 341 marcas, das ferramentas elétricas e manuais ao EPI completo, com nota fiscal, compra com CNPJ e entrega no estado, além da opção de retirada na loja em Natal."}, {"type": "paragraph", "text": "Marque os itens da sua lista no catálogo, monte o orçamento e fale com a equipe pelo WhatsApp. Você recebe orientação técnica antes de fechar, confirma prazo e fecha a compra com nota fiscal. Para conhecer todas as condições para empresa, veja a página de fornecedor de ferramentas no RN e comece o seu orçamento pelo catálogo."}]$json$::jsonb,
  (select id from clusters where slug = $txt$fornecedor-industrial-rn$txt$),
  false,
  $txt$Como Escolher Fornecedor de Ferramentas no RN$txt$,
  $txt$Saiba como escolher um fornecedor de ferramentas RN: variedade, estoque, nota fiscal, prazo, suporte técnico e entrega no interior. Guia B2B da Natalmaq em Natal.$txt$,
  array[
      $kw$fornecedor ferramentas rn$kw$,
      $kw$distribuidor ferramentas natal$kw$,
      $kw$fornecedor industrial rn$kw$,
      $kw$fornecedor de ferramentas natal rn$kw$,
      $kw$distribuidor de ferramentas rio grande do norte$kw$,
      $kw$comprar ferramentas com cnpj rn$kw$,
      $kw$fornecedor de epi natal$kw$,
      $kw$ferramentas para empresa rn$kw$
    ],
  'publicado', now(), 'Equipe Natalmaq',
  5,
  $json$[{"pergunta": "Vocês entregam no interior do RN?", "resposta": "Sim. A Natalmaq atende todo o Rio Grande do Norte, com entrega em Natal, na Grande Natal e nas cidades do interior. Você também pode retirar na loja em Natal quando preferir."}, {"pergunta": "Atendem empresas que compram com CNPJ?", "resposta": "Sim. O atendimento é B2B, com compra por CNPJ, condições para pedido em volume e reposição recorrente para sua equipe ou frota."}, {"pergunta": "O fornecedor emite nota fiscal?", "resposta": "Sim. Toda compra sai com nota fiscal, o que garante a garantia do fabricante e o lançamento da despesa pela sua empresa."}, {"pergunta": "Qual o prazo de entrega em Natal?", "resposta": "O prazo varia conforme o item e o destino. Fale com a equipe pelo WhatsApp ao montar o orçamento para confirmar o prazo do seu pedido em Natal ou no interior."}, {"pergunta": "Como faço um orçamento de ferramentas?", "resposta": "Marque os produtos que você precisa no catálogo, monte o orçamento e envie pelo WhatsApp. A equipe responde com valores, prazo e nota fiscal, e ajuda na escolha técnica."}]$json$::jsonb,
  null::jsonb,
  0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  categoria_label  = excluded.categoria_label,
  excerpt          = excluded.excerpt,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  eh_pilar         = excluded.eh_pilar,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords         = excluded.keywords,
  status           = excluded.status,
  published_at     = excluded.published_at,
  autor_nome       = excluded.autor_nome,
  reading_time     = excluded.reading_time,
  faq              = excluded.faq,
  howto            = excluded.howto,
  ordem            = excluded.ordem;

-- ----------------------------------------------------------------------------
-- c) Landing pages B2B/local — INSERT ... ON CONFLICT (slug) DO UPDATE.
--    ctaWhatsappMsg materializada como bloco 'paragraph' final do corpo
--    (sem coluna dedicada — ver followups). howto da landing omitido (sem coluna).
-- ----------------------------------------------------------------------------

-- Landing: comprar-ferramentas-cnpj-natal-rn  (cluster comprar-ferramentas-cnpj)
insert into landing_pages (
  slug, titulo, subtitulo, cidade, uf, publico, corpo, cluster_id,
  meta_title, meta_description, faq, status, published_at, ordem
) values (
  $txt$comprar-ferramentas-cnpj-natal-rn$txt$,
  $txt$Comprar ferramentas com CNPJ em Natal/RN$txt$,
  $txt$Compre com CNPJ e nota fiscal, com orçamento rápido pelo WhatsApp e entrega em todo o Rio Grande do Norte.$txt$,
  $txt$Natal$txt$,
  $txt$RN$txt$,
  $txt$empresas e profissionais com CNPJ$txt$,
  $json$[{"type": "paragraph", "text": "A compra B2B de ferramentas industriais com CNPJ na Natalmaq é direta: você monta o orçamento pelo catálogo, informa o CNPJ da empresa no WhatsApp e recebe a cotação já com nota fiscal. Atendemos empresas e profissionais de construção, indústria, marcenaria, elétrica e manutenção em Natal e em todo o Rio Grande do Norte, com mais de 11 mil itens ativos e estoque local."}, {"type": "paragraph", "text": "Comprar com CNPJ não é só formalizar a nota. É garantir procedência, garantia para pessoa jurídica e um fornecedor que entende a rotina de quem precisa repor ferramenta e EPI sem parar a operação."}, {"type": "heading", "text": "Como funciona a compra com CNPJ"}, {"type": "paragraph", "text": "O processo foi pensado para ser rápido, sem burocracia desnecessária. Em quatro passos você sai do catálogo com a ferramenta orçada e a nota emitida:"}, {"type": "list", "items": ["Monte a cesta no catálogo escolhendo as ferramentas, máquinas e EPI que a equipe precisa.", "Informe o CNPJ da empresa no WhatsApp e envie a lista de itens.", "Receba o orçamento com nota fiscal, condições de pagamento e prazo de entrega.", "Aprove o pedido e combine a entrega no RN ou a retirada na loja em Natal."]}, {"type": "heading", "text": "Por que comprar ferramentas com CNPJ na Natalmaq"}, {"type": "paragraph", "text": "Somos especializados no atendimento a empresas que compram com CNPJ e exigem nota fiscal em toda operação. O catálogo reúne marcas profissionais como Bosch, DeWalt, Makita, Vonder, Tramontina, Gedore e King Tony em ferramentas, além de 3M, MSA, Marluvas e Kalipso na linha de EPI."}, {"type": "list", "items": ["Nota fiscal em todos os pedidos, com os dados corretos da sua empresa para crédito e contabilidade.", "Faturamento para empresa: combine as condições de pagamento direto com a equipe comercial.", "Garantia PJ pelas marcas, com procedência e produto novo de fábrica.", "Mais de 11 mil itens ativos: furadeira, parafusadeira, esmerilhadeira, lixadeira, motoserra, disco, broca, alicate, chave, capacete, luva, óculos, bota, protetor e máscara.", "Estoque local em Natal, o que reduz prazo e evita esperar produto de fora do estado.", "Entrega em todo o RN e opção de retirada na loja, você escolhe o que for mais ágil."]}, {"type": "heading", "text": "Para quem compra em volume ou repõe estoque"}, {"type": "paragraph", "text": "Se a sua empresa equipa uma equipe inteira, repõe ferramenta com frequência ou monta kit de EPI para o canteiro, vale falar com a equipe sobre compra recorrente. Você padroniza marcas e modelos (por exemplo furadeira de impacto Bosch GSB 13 RE ou serra circular DeWalt DWE560), mantém a nota fiscal organizada e ganha agilidade na próxima reposição."}, {"type": "paragraph", "text": "Itens de segurança seguem com Certificado de Aprovação (CA) ativo, atendendo às exigências da NR-6 para fornecimento de EPI. Para máquinas e ferramentas, a procedência das marcas garante peças e assistência dentro das normas aplicáveis, como a NR-12 de segurança em máquinas."}, {"type": "heading", "text": "Peça seu orçamento agora"}, {"type": "paragraph", "text": "Monte o orçamento pelo catálogo e fale com a equipe da Natalmaq no WhatsApp informando o CNPJ da sua empresa. Você recebe a cotação com nota fiscal, condição de pagamento e prazo de entrega no RN, tudo no mesmo atendimento. Consulte o orçamento e feche a compra B2B sem complicação."}, {"type": "paragraph", "text": "Fale agora pelo WhatsApp para montar seu orçamento. É só começar a conversa: “Olá! Quero comprar ferramentas com CNPJ. Minha empresa é…” e a equipe da Natalmaq responde com os itens, a nota fiscal e o prazo de entrega."}]$json$::jsonb,
  (select id from clusters where slug = $txt$comprar-ferramentas-cnpj$txt$),
  $txt$Comprar Ferramentas com CNPJ em Natal/RN | Natalmaq$txt$,
  $txt$Compra B2B de ferramentas industriais com CNPJ em Natal/RN: nota fiscal, faturamento, garantia PJ e orçamento rápido pelo WhatsApp. Mais de 11 mil itens.$txt$,
  $json$[{"pergunta": "Posso comprar ferramentas com CNPJ na Natalmaq?", "resposta": "Sim. A Natalmaq atende empresas e profissionais com CNPJ em Natal e em todo o RN. Basta montar o orçamento e informar o CNPJ no WhatsApp para receber a cotação."}, {"pergunta": "A compra sai com nota fiscal?", "resposta": "Sim, todos os pedidos são faturados com nota fiscal usando os dados da sua empresa, o que permite crédito fiscal e organização contábil."}, {"pergunta": "Tem faturamento para empresa?", "resposta": "As condições de pagamento e faturamento são combinadas direto com a equipe comercial ao fechar o orçamento. Consulte a equipe pelo WhatsApp."}, {"pergunta": "A garantia muda na compra com CNPJ?", "resposta": "Não. Os produtos são novos, de marcas como Bosch, DeWalt, Makita e Vonder, com a garantia oficial do fabricante válida também para pessoa jurídica."}, {"pergunta": "Vocês entregam em Natal e no interior do RN?", "resposta": "Sim. Entregamos em todo o Rio Grande do Norte e também oferecemos retirada na loja em Natal, com estoque local para reduzir o prazo."}]$json$::jsonb,
  'publicado', now(), 0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  subtitulo        = excluded.subtitulo,
  cidade           = excluded.cidade,
  uf               = excluded.uf,
  publico          = excluded.publico,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  faq              = excluded.faq,
  status           = excluded.status,
  published_at     = excluded.published_at,
  ordem            = excluded.ordem;

-- Landing: fornecedor-ferramentas-rn  (cluster fornecedor-industrial-rn)
insert into landing_pages (
  slug, titulo, subtitulo, cidade, uf, publico, corpo, cluster_id,
  meta_title, meta_description, faq, status, published_at, ordem
) values (
  $txt$fornecedor-ferramentas-rn$txt$,
  $txt$Fornecedor de ferramentas no Rio Grande do Norte$txt$,
  $txt$$txt$,
  $txt$Natal$txt$,
  $txt$RN$txt$,
  $txt$empresas, obras e revendas no RN$txt$,
  $json$[{"type": "paragraph", "text": "A Natalmaq é fornecedor de ferramentas no RN para empresas, obras e revendas que precisam comprar com segurança, nota fiscal e prazo. Você monta o orçamento direto no catálogo, com mais de 11 mil produtos ativos das principais marcas do mercado, e fecha pelo WhatsApp com atendimento de quem entende do que você usa no dia a dia."}, {"type": "paragraph", "text": "Quem trabalha com construção, indústria, marcenaria, elétrica e manutenção não pode parar a obra esperando reposição. Por isso reunimos linha completa de ferramentas, máquinas, abrasivos, solda e EPI em um só lugar, com compra por CNPJ e entrega de Natal ao interior do estado."}, {"type": "heading", "text": "Por que escolher a Natalmaq como fornecedor de ferramentas no RN"}, {"type": "paragraph", "text": "Comprar de um único fornecedor que tem catálogo amplo, marcas confiáveis e nota fiscal reduz dor de cabeça e padroniza o que entra na sua equipe. Veja o que você ganha trabalhando com a gente:"}, {"type": "list", "items": ["Mais de 11.806 produtos ativos e 341 marcas em um só catálogo, do parafuso ao equipamento pesado", "Marcas líderes: Bosch, DeWalt, Makita, Einhell, Vonder, Tramontina, Stanley, Irwin, Gedore, King Tony e Starrett", "EPI com procedência e CA ativo: capacete, luva, óculos, bota, protetor auricular e máscara das marcas 3M, Kalipso, MSA e Marluvas", "Nota fiscal em toda compra e atendimento B2B com CNPJ", "Entrega para Natal, região metropolitana e interior do RN", "Orçamento rápido pelo WhatsApp, com orientação técnica antes de fechar"]}, {"type": "heading", "text": "Linhas de produto que fornecemos"}, {"type": "paragraph", "text": "Como fornecedor de ferramentas no RN, atendemos os perfis que mais demandam reposição constante. Você encontra desde a ferramenta manual do kit básico até máquinas e insumos de uso intenso:"}, {"type": "list", "items": ["Ferramentas elétricas: furadeira, parafusadeira, esmerilhadeira, lixadeira, perfurador e motoserra", "Acessórios e consumíveis: disco, broca, bateria e carregador para uso profissional", "Ferramentas manuais: alicate, chave, martelo, marreta e nível das marcas Gedore, King Tony, Tramontina e Stanley", "Solda e abrasivos: equipamentos Esab, Lincoln e Boxer e abrasivos Norton para corte e desbaste", "EPI e segurança: capacete, luva, óculos, bota, protetor auricular e máscara conforme a NR-6, com CA ativo"]}, {"type": "paragraph", "text": "Se a sua operação trabalha com máquinas, vale lembrar que os equipamentos precisam atender exigências de proteção previstas na NR-12, e o time pode te orientar na escolha certa para o tipo de serviço."}, {"type": "heading", "text": "Cobertura: de Natal ao interior do estado"}, {"type": "paragraph", "text": "Atendemos Natal e a Grande Natal (Parnamirim, São Gonçalo do Amarante, Macaíba e região metropolitana) com prazo curto, além do interior do RN. Pedidos para o interior são atendidos com logística própria de entrega, e o valor e o prazo são confirmados no orçamento de acordo com o seu CEP."}, {"type": "paragraph", "text": "Para revendas e empresas com consumo recorrente, organizamos a reposição de estoque para você não ficar na mão no meio do serviço. Informe a região e o volume que precisa e a equipe monta a melhor condição."}, {"type": "heading", "text": "Como funciona o orçamento"}, {"type": "paragraph", "text": "O processo é direto e pensado para quem precisa de resposta rápida, sem burocracia:"}, {"type": "list", "items": ["Monte a sua cesta no catálogo com as ferramentas, máquinas e EPI que precisa", "Envie o pedido pelo WhatsApp informando a cidade e o CNPJ da empresa", "Receba o orçamento com os itens, a nota fiscal e o frete para a sua região", "Aprove e combine entrega ou retirada na loja em Natal"]}, {"type": "paragraph", "text": "Precisa de ajuda para escolher o modelo certo, comparar uma Bosch GSB 13 RE com outra opção ou definir o EPI para a sua função? Fale com a equipe antes de fechar. Monte o seu orçamento pelo catálogo e chame no WhatsApp para comprar com CNPJ, nota fiscal e entrega em todo o RN."}, {"type": "paragraph", "text": "Fale agora pelo WhatsApp para montar seu orçamento. É só começar a conversa: “Olá! Quero um orçamento de ferramentas. Atendo em…” e a equipe da Natalmaq responde com os itens, a nota fiscal e o prazo de entrega."}]$json$::jsonb,
  (select id from clusters where slug = $txt$fornecedor-industrial-rn$txt$),
  $txt$Fornecedor de Ferramentas RN | Natalmaq Natal$txt$,
  $txt$Fornecedor de ferramentas, máquinas e EPI no RN. Mais de 11 mil itens, marcas líderes, nota fiscal e entrega de Natal ao interior. Peça orçamento pelo WhatsApp.$txt$,
  $json$[{"pergunta": "Quais regiões do RN a Natalmaq atende?", "resposta": "Atendemos Natal, a região metropolitana (Parnamirim, São Gonçalo do Amarante, Macaíba e cidades vizinhas) e o interior do Rio Grande do Norte. O frete e o prazo são confirmados no orçamento conforme o seu CEP."}, {"pergunta": "A Natalmaq vende para empresa com CNPJ e emite nota fiscal?", "resposta": "Sim. Somos fornecedor B2B e emitimos nota fiscal em toda compra. Informe o CNPJ no WhatsApp para receber o orçamento já com a NF."}, {"pergunta": "Quantos produtos e marcas estão disponíveis no catálogo?", "resposta": "São mais de 11 mil produtos ativos e 341 marcas, incluindo Bosch, DeWalt, Makita, Vonder, Tramontina, Gedore e marcas de EPI como 3M, Kalipso e Marluvas."}, {"pergunta": "A Natalmaq fornece EPI junto com as ferramentas?", "resposta": "Sim. Trabalhamos com capacete, luva, óculos, bota, protetor auricular e máscara, todos com CA ativo conforme a NR-6, no mesmo pedido das ferramentas."}, {"pergunta": "Como peço um orçamento de ferramentas?", "resposta": "Monte a sua cesta no catálogo e envie pelo WhatsApp informando a cidade e o CNPJ. A equipe retorna com os itens, a nota fiscal e o frete para a sua região."}]$json$::jsonb,
  'publicado', now(), 0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  subtitulo        = excluded.subtitulo,
  cidade           = excluded.cidade,
  uf               = excluded.uf,
  publico          = excluded.publico,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  faq              = excluded.faq,
  status           = excluded.status,
  published_at     = excluded.published_at,
  ordem            = excluded.ordem;

-- Landing: distribuidor-industrial-natal-rn  (cluster fornecedor-industrial-rn)
insert into landing_pages (
  slug, titulo, subtitulo, cidade, uf, publico, corpo, cluster_id,
  meta_title, meta_description, faq, status, published_at, ordem
) values (
  $txt$distribuidor-industrial-natal-rn$txt$,
  $txt$Distribuidor industrial em Natal/RN$txt$,
  $txt$Distribuidor para indústria e revenda: ferramentas, abrasivos, solda e EPI com nota fiscal, compra com CNPJ e entrega em todo o Rio Grande do Norte.$txt$,
  $txt$Natal$txt$,
  $txt$RN$txt$,
  $txt$Indústria, manutenção e revenda$txt$,
  $json$[{"type": "paragraph", "text": "A Natalmaq é distribuidor industrial em Natal/RN para indústria, manutenção e revenda, com mais de 11 mil produtos ativos de 341 marcas em ferramentas, abrasivos, solda, máquinas e EPI. Você monta o pedido pelo catálogo, fecha pelo WhatsApp com nota fiscal e CNPJ, e recebe em Natal ou no interior do estado."}, {"type": "paragraph", "text": "Trabalhamos focados em quem compra para produzir, manter parado o mínimo possível e revender. Por isso, o atendimento é técnico e direto: você fala com quem entende de máquina, disco e EPI, e sai com o item certo na cotação, não com um substituto que não serve."}, {"type": "heading", "text": "Segmentos que atendemos"}, {"type": "paragraph", "text": "O catálogo cobre as principais frentes de quem trabalha com produção e manutenção no Rio Grande do Norte. Atendemos compras pontuais e abastecimento recorrente de estoque."}, {"type": "list", "items": ["Indústria e linha de produção: ferramentas, abrasivos, solda e reposição de consumíveis", "Manutenção industrial e predial: equipes de facilities, condomínios e plantas fabris", "Construção e obra: ferramenta elétrica, medição e proteção individual", "Marcenaria e serralheria: serras, discos, lixas e acessórios de corte", "Elétrica e instalação: furadeiras, parafusadeiras, alicates e ferramentas isoladas", "Revenda e lojas: compra em volume para abastecer prateleira com marcas reconhecidas"]}, {"type": "heading", "text": "Linhas industriais que você encontra no distribuidor"}, {"type": "paragraph", "text": "A linha é completa de verdade, não apenas ferramenta elétrica. Como distribuidor industrial em Natal/RN, concentramos em um só fornecedor as categorias que sua equipe usa todo dia, com marcas profissionais em cada frente."}, {"type": "list", "items": ["Abrasivos e corte: disco de corte e desbaste, lixas e acessórios Norton para metal, alvenaria e madeira", "Ferramentas elétricas: furadeira, parafusadeira, esmerilhadeira, lixadeira e perfurador Bosch, DeWalt, Makita, Einhell e Skil", "Ferramentas manuais e medição: alicate, chave, martelo, marreta e nível Tramontina, Gedore, King Tony, Irwin e Starrett", "Solda: equipamentos e consumíveis Esab, Lincoln e Boxer", "EPI completo: capacete, luva, óculos, bota, protetor auricular e máscara 3M, MSA, Marluvas, Kalipso e Steelflex, sempre com CA ativo", "Baterias, carregadores e acessórios para manter as máquinas sem fio rodando"]}, {"type": "heading", "text": "Como funciona a compra"}, {"type": "paragraph", "text": "O processo é pensado para empresa, sem burocracia que atrasa a sua produção. Em poucos passos você sai do catálogo para a entrega."}, {"type": "list", "items": ["Monte a lista pelo catálogo, com os itens e quantidades que a empresa precisa", "Envie pelo WhatsApp informando o CNPJ para receber o orçamento com nota fiscal", "Aprove a cotação, combine pagamento e defina entrega ou retirada na loja", "Receba em Natal ou no interior do RN, com possibilidade de pedido recorrente para repor estoque"]}, {"type": "heading", "text": "Por que comprar na Natalmaq"}, {"type": "paragraph", "text": "Comprar de um distribuidor local que entende de indústria muda o seu dia a dia: menos máquina parada por falta de peça, menos frete vindo de fora e mais agilidade quando o serviço não pode esperar."}, {"type": "list", "items": ["Estoque local em Natal, com mais de 11.806 produtos ativos de 341 marcas", "Compra com CNPJ e nota fiscal para todo pedido, com garantia de procedência", "Compra em volume para frota, equipe e reposição de prateleira na revenda", "Entrega em Natal, região metropolitana e interior do Rio Grande do Norte", "Atendimento técnico para indicar o disco, a ferramenta ou o EPI certo antes de fechar", "Marcas profissionais em abrasivos, ferramentas, solda e proteção individual"]}, {"type": "heading", "text": "Entrega no interior do RN e compra em volume"}, {"type": "paragraph", "text": "Sua empresa não precisa estar em Natal para comprar com a gente. Atendemos a capital, a região metropolitana e cidades do interior do RN, com logística pensada para quem está fora do eixo da capital."}, {"type": "paragraph", "text": "Para pedidos em volume, abastecimento de estoque ou cotação recorrente, fale com a equipe pelo WhatsApp. Montamos o orçamento com nota fiscal, condição para empresa e prazo combinado de entrega ou retirada. Consulte o orçamento para valores e disponibilidade dos itens."}, {"type": "paragraph", "text": "Fale agora pelo WhatsApp para montar seu orçamento. É só começar a conversa: “Olá! Sou de uma empresa e quero falar sobre fornecimento industrial.…” e a equipe da Natalmaq responde com os itens, a nota fiscal e o prazo de entrega."}]$json$::jsonb,
  (select id from clusters where slug = $txt$fornecedor-industrial-rn$txt$),
  $txt$Distribuidor Industrial Natal/RN | Natalmaq$txt$,
  $txt$Distribuidor industrial em Natal/RN: ferramentas, abrasivos, solda, máquinas e EPI para indústria, manutenção e revenda. Compra em volume, nota fiscal e entrega no interior.$txt$,
  $json$[{"pergunta": "Vocês atendem indústria e revenda?", "resposta": "Sim. Somos distribuidor industrial em Natal/RN para indústria, manutenção predial e revenda, com atendimento B2B e compra com CNPJ. Atendemos desde pedidos pontuais até abastecimento recorrente de estoque."}, {"pergunta": "Vocês têm linha completa, com abrasivos e EPI?", "resposta": "Sim. O catálogo cobre ferramentas elétricas e manuais, abrasivos (disco e lixa Norton), solda (Esab, Lincoln, Boxer) e EPI completo (capacete, luva, óculos, bota, protetor e máscara) com CA ativo das principais marcas."}, {"pergunta": "Fazem entrega no interior do Rio Grande do Norte?", "resposta": "Sim. Entregamos em Natal, na região metropolitana e em cidades do interior do RN. Fale com a equipe pelo WhatsApp com o endereço da empresa para confirmar prazo e frete no orçamento."}, {"pergunta": "Vendem em volume para empresas?", "resposta": "Sim. Trabalhamos com compra em volume para frota, equipe e reposição de prateleira na revenda. Monte a lista pelo catálogo e fale no WhatsApp para receber a condição para o seu pedido."}, {"pergunta": "Emitem nota fiscal na compra com CNPJ?", "resposta": "Sim. Toda compra sai com nota fiscal e pode ser faturada no CNPJ da empresa, com garantia de procedência das marcas. Informe o CNPJ ao pedir o orçamento pelo WhatsApp."}]$json$::jsonb,
  'publicado', now(), 0
)
on conflict (slug) do update set
  titulo           = excluded.titulo,
  subtitulo        = excluded.subtitulo,
  cidade           = excluded.cidade,
  uf               = excluded.uf,
  publico          = excluded.publico,
  corpo            = excluded.corpo,
  cluster_id       = excluded.cluster_id,
  meta_title       = excluded.meta_title,
  meta_description = excluded.meta_description,
  faq              = excluded.faq,
  status           = excluded.status,
  published_at     = excluded.published_at,
  ordem            = excluded.ordem;

commit;
