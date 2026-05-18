"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Grid3X3,
  Image,
  Ticket,
  FileSpreadsheet,
  FileImage,
  BarChart3,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
      { href: "/admin/produtos", label: "Produtos", icon: Package },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { href: "/admin/curva-abc", label: "Curva ABC", icon: BarChart3 },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/admin/marcas", label: "Marcas", icon: Tag },
      { href: "/admin/categorias", label: "Categorias", icon: Grid3X3 },
      { href: "/admin/banners", label: "Banners", icon: Image },
      { href: "/admin/cupons", label: "Cupons", icon: Ticket },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { href: "/admin/importar", label: "Importar planilha", icon: FileSpreadsheet, exact: true },
      { href: "/admin/importar-fotos", label: "Importar fotos PDF", icon: FileImage },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 p-3 text-sm">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href as never}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 transition ${
                    isActive
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : "text-zinc-400"}`}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
