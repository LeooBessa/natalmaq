"use client";

import { useEffect } from "react";

export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const type = params.get("type");
    const access_token = params.get("access_token");

    // Redireciona para /auth/nova-senha preservando o hash para ser processado lá
    if (type === "recovery" && access_token) {
      window.location.href = `/auth/nova-senha${hash}`;
    }
  }, []);

  return null;
}
