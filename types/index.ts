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

export type Vaga = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string | null;
  local: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
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

export type Cupom = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: "percentual" | "fixo";
  valor: number;
  valor_minimo: number;
  usos_max: number | null;
  usos_atual: number;
  ativo: boolean;
  exibir_home: boolean;
  validade: string | null;
  created_at: string;
};

export type CupomHome = Pick<Cupom, "id" | "codigo" | "descricao" | "tipo" | "valor">;

export type Cliente = {
  id: string;
  nome: string;
  contato: string;
  email: string;
  endereco: Endereco | null;
  criado_em: string;
};

export type TipoEntrega = "entrega" | "retirada";

export type PedidoInput = {
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email?: string;
  tipo_entrega: TipoEntrega;
  endereco?: Endereco | null;
  observacoes?: string;
  itens: { produto_id: string; quantidade: number }[];
  frete_valor: number;
  cupom_codigo?: string;
  desconto_valor?: number;
  cliente_id?: string;
};

export type PedidoCriado = {
  id: string;
  numero: number;
  whatsapp_url: string;
  total: number;
};
