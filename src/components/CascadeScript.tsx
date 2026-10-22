"use client";

import { useEffect } from "react";

export function CascadeScript() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/cascade-browser-integration.js";
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
}
