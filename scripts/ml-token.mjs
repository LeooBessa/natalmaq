/**
 * Troca o `code` do OAuth do Mercado Livre por um access_token.
 *
 * Passo a passo:
 *  1. Crie um app em https://developers.mercadolivre.com.br (Suas aplicações)
 *  2. Em "Redirect URI" use: https://natalmaq-main.vercel.app
 *  3. Abra no navegador (troque APP_ID):
 *     https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=APP_ID&redirect_uri=https://natalmaq-main.vercel.app
 *  4. Autorize. Você será redirecionado para uma URL com ?code=TG-xxxxx
 *  5. Copie esse `code` e rode:
 *     node scripts/ml-token.mjs <APP_ID> <SECRET> <CODE>
 */

const [, , appId, secret, code] = process.argv;
const REDIRECT = "https://natalmaq-main.vercel.app";

if (!appId || !secret || !code) {
  console.error("Uso: node scripts/ml-token.mjs <APP_ID> <SECRET> <CODE>");
  process.exit(1);
}

const resp = await fetch("https://api.mercadolibre.com/oauth/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    accept: "application/json",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: appId,
    client_secret: secret,
    code,
    redirect_uri: REDIRECT,
  }),
});

const data = await resp.json();
if (!resp.ok) {
  console.error("Erro ao obter token:", JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log("\n=== ACCESS TOKEN (válido por ~6h) ===\n");
console.log(data.access_token);
console.log("\nUse-o em: node --env-file=.env.local scripts/buscar-fotos-ml.mjs " + data.access_token);
