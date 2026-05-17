"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (type === "recovery" && access_token && refresh_token) {
      const sb = createSupabaseBrowserClient();
      sb.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (!error) {
          window.location.hash = "";
          router.push("/auth/nova-senha");
        }
      });
    }
  }, [router]);

  return null;
}
