import { NscaleWordmarkLogo } from "@nscaledev/ui/logos/nscale-logo-wordmark";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="w-full border-b border-primary-border bg-primary-background">
      <div className="px-6 py-4">
        <Link href="/" aria-label="Nscale OpenAPI Specs — home">
          <NscaleWordmarkLogo width={120} height={24} />
        </Link>
      </div>
    </header>
  );
}
