"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button onClick={() => window.location.reload()} size="lg">
      <RefreshCw className="size-4" aria-hidden /> Tentar novamente
    </Button>
  );
}
