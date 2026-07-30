"use client";

import { Button } from "@/components/ui/Button";

/**
 * Retry on the offline page.
 *
 * `location.reload()` rather than `router.refresh()`: the App Router's refresh
 * needs a working connection to fetch the RSC payload, which is precisely what
 * is missing here. A full reload retries the navigation the service worker
 * could not complete.
 */
export function RetryButton({ label }: { label: string }) {
  return (
    <Button fullWidth={false} onClick={() => location.reload()}>
      {label}
    </Button>
  );
}
