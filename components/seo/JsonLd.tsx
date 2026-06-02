// Injetor de JSON-LD. Recebe um objeto ou array de nós; se array, embrulha em
// {"@context":"https://schema.org","@graph":[...]} (doc 02 §4.3).
// Schema é dado controlado (sem input cru do usuário), mas nunca interpolamos
// HTML — só JSON.stringify dentro de <script type="application/ld+json">.

export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : data;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
