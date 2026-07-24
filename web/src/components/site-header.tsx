import { NscaleWordmarkLogo } from "@nscaledev/ui/logos/nscale-logo-wordmark";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-primary-border">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <Link href="/" aria-label="Nscale OpenAPI Specs — home">
          <NscaleWordmarkLogo width={120} height={24} />
        </Link>
      </div>
    </header>
  );
}
