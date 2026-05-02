export type Marca = {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
};

export type Categoria = {
  id: string;
  nome: string;
  slug: string;
  parent_id: string | null;
};

export type Produto = {
  id: string;
  codigo: string;
  slug: string;
  nome: string;
  descricao: string | null;
  marca_id: string | null;
  categoria_id: string | null;
  preco: number;
  preco_promocional: number | null;
  estoque: number;
  peso_kg: number;
  imagens: string[];
  complementares: string[];
  ativo: boolean;
  destaque: boolean;
  produto_pai_id: string | null;
  variante_label: string | null;
};

export type ProdutoComMarca = Produto & {
  marca?: Pick<Marca, "id" | "nome" | "slug"> | null;
  categoria?: Pick<Categoria, "id" | "nome" | "slug"> | null;
};

export type Banner = {
  id: string;
  titulo: string | null;
  imagem_url: string;
  link: string | null;
  ordem: number;
};

export type CartItem = {
  produto_id: string;
  codigo: string;
  slug: string;
  nome: string;
  imagem: string | null;
  preco_unit: number;          // já considera promo
  quantidade: number;
  estoque: number;
  peso_kg: number;
};

export type Endereco = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
};

export type FreteCalculado = {
  valor: number;
  prazo_dias: number;
  regiao: string;
};

export type PedidoInput = {
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email?: string;
  endereco: Endereco;
  observacoes?: string;
  itens: { produto_id: string; quantidade: number }[];
  frete_valor: number;
};

export type PedidoCriado = {
  id: string;
  numero: number;
  whatsapp_url: string;
  total: number;
};
