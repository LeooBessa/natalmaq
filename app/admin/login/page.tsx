import { LoginForm } from "./LoginForm";

export const metadata = { title: "Login admin" };

type SearchParams = Promise<{ redirect?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-bold">Acesso administrativo</h1>
      <LoginForm redirectTo={sp.redirect ?? "/admin/dashboard"} />
    </div>
  );
}
