"use client";

import { useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart-store";
import { syncCartAction, loadCartAction } from "@/lib/cart-server";

export function CartSyncProvider({ children }: { children: React.ReactNode }) {
  const itens = useCart((s) => s.itens);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // canSync = false blocks sync while mergeAndLoad is running (prevents racing DB read/write)
  const canSync = useRef(false);

  const mergeAndLoad = async () => {
    canSync.current = false;
    const dbItens = await loadCartAction();
    if (dbItens === null) {
      canSync.current = true;
      return;
    }

    // Merge DB cart into local, keeping max quantity for duplicates
    const local = useCart.getState().itens;
    const merged = [...local];
    for (const db of dbItens) {
      const idx = merged.findIndex((i) => i.produto_id === db.produto_id);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          quantidade: Math.max(merged[idx].quantidade, db.quantidade),
        };
      } else {
        merged.push(db);
      }
    }

    useCart.setState({ itens: merged });
    await syncCartAction(merged);
    canSync.current = true;
  };

  useEffect(() => {
    const sb = createSupabaseBrowserClient();

    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mergeAndLoad();
      } else {
        canSync.current = true;
      }
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") mergeAndLoad();
      if (event === "SIGNED_OUT") canSync.current = false;
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced sync on every cart change
  useEffect(() => {
    if (!canSync.current) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      const sb = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) return;
      await syncCartAction(itens);
    }, 500);

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [itens]);

  return <>{children}</>;
}
