import type {
  Banner,
  Categoria,
  FreteCalculado,
  Marca,
  PedidoCriado,
  PedidoInput,
  ProdutoComMarca,
} from "@/types";

// No browser: relative URLs (same origin, no CORS).
// On the server (SSR): needs absolute URL.
const baseUrl =
  typeof window !== "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "");

async function request<T>(
  path: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<T> {
  const url = baseUrl ? `${baseUrl}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} falhou (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  produtos: {
    list: (params?: {
      marca?: string;
      categoria?: string;
      q?: string;
      page?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params?.marca) sp.set("marca", params.marca);
      if (params?.categoria) sp.set("categoria", params.categoria);
      if (params?.q) sp.set("q", params.q);
      if (params?.page) sp.set("page", String(params.page));
      return request<{ items: ProdutoComMarca[]; total: number }>(
        `/api/produtos${sp.toString() ? "?" + sp : ""}`,
        { next: { revalidate: 60 } },
      );
    },
    bySlug: (slug: string) =>
      request<ProdutoComMarca & { complementares_produtos: ProdutoComMarca[] }>(
        `/api/produtos/${slug}`,
        { next: { revalidate: 60 } },
      ),
  },
  busca: {
    autocomplete: (q: string) =>
      request<{ items: Pick<ProdutoComMarca, "id" | "slug" | "nome" | "preco" | "preco_promocional" | "imagens">[] }>(
        `/api/busca/autocomplete?q=${encodeURIComponent(q)}`,
      ),
  },
  marcas: {
    list: () =>
      request<{ items: Marca[] }>(`/api/marcas`, {
        next: { revalidate: 300 },
      }),
  },
  categorias: {
    list: () =>
      request<{ items: Categoria[] }>(`/api/categorias`, {
        next: { revalidate: 300 },
      }),
  },
  banners: {
    list: () =>
      request<{ items: Banner[] }>(`/api/banners`, {
        next: { revalidate: 60 },
      }),
  },
  frete: {
    calcular: (cep: string, peso_total: number) =>
      request<FreteCalculado>(`/api/frete/calcular`, {
        method: "POST",
        body: JSON.stringify({ cep, peso_total }),
      }),
  },
  pedidos: {
    criar: (input: PedidoInput) =>
      request<PedidoCriado>(`/api/pedidos`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  },
};
