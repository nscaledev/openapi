import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  ClockIcon,
  CodeBracketIcon,
  CodeBracketSquareIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@nscaledev/ui/components-v2/button";
import { HeroBanner } from "@nscaledev/ui/components-v2/hero-banner";
import Link from "next/link";
import { fetchServiceIndex } from "@/lib/raw-content";
import {
  shapeCatalog,
  type ServiceCatalogEntry,
} from "@/lib/service-catalog";

function ServiceRow({ service }: { service: ServiceCatalogEntry }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b border-primary-border last:border-b-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <CodeBracketSquareIcon className="size-8 shrink-0 text-secondary-content" />
        <div className="min-w-0">
          <p className="font-semibold text-primary-content truncate">
            {service.title}
          </p>
          <p className="text-sm text-secondary-content">v{service.version}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="default">
          <Link href={`/reference/${service.id}`}>
            <BookOpenIcon /> Reference
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a href={`/specs/${service.id}/openapi.yaml`}>
            <DocumentTextIcon /> YAML
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/specs/${service.id}/openapi.json`}>
            <CodeBracketIcon /> JSON
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/specs/${service.id}/CHANGELOG.md`}>
            <ClockIcon /> Changelog
          </a>
        </Button>
        {service.docsUrl && (
          <Button asChild variant="outline">
            <a href={service.docsUrl}>
              <ArrowTopRightOnSquareIcon /> Docs
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}

export default async function LandingPage() {
  const index = await fetchServiceIndex();
  const services = shapeCatalog(index);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-8">
      <HeroBanner
        eyebrow="Nscale"
        title="OpenAPI Specs"
        icon={<CodeBracketSquareIcon />}
      />
      {services.length === 0 ? (
        <p className="text-secondary-content">No services published yet.</p>
      ) : (
        <ul className="flex flex-col">
          {services.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))}
        </ul>
      )}
    </main>
  );
}
