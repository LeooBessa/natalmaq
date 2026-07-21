// Constantes centrais de SEO (custo zero, determinístico).
// SITE_URL espelha o padrão já usado em app/layout.tsx e app/(public)/artigos.
// Os @ids (#organization, #store, #website) permitem que páginas referenciem
// a mesma entidade no @graph sem duplicar dados.

import { SITE_URL } from "@/lib/site-url";

export { SITE_URL };

export const ORG_ID = `${SITE_URL}/#organization`;
export const STORE_ID = `${SITE_URL}/#store`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const ORG_NAME = "Natalmaq";
export const ORG_LOGO = `${SITE_URL}/brand/natalmaq-lockup.png`;
export const ORG_PHONE = "+55-84-3025-9789";

// Perfis sociais (E-E-A-T / sameAs). Vazio por enquanto: o usuário ainda não
// passou redes sociais / Google Business Profile. Preencher depois habilita
// `sameAs` (organization/store) e `hasMap` (store) automaticamente.
export const ORG_SAMEAS: string[] = [];

// Geo da loja (Alecrim, Natal/RN). PLACEHOLDER aproximado — confirmar
// coordenadas reais com o usuário antes de considerar definitivo.
export const LOJA_GEO = { latitude: -5.806, longitude: -35.211 };
