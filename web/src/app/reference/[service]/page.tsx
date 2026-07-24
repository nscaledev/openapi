import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { notFound } from "next/navigation";
import { isValidServiceId } from "@/lib/service-param";
import { serviceSpecJsonUrl } from "@/lib/raw-content";

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  if (!isValidServiceId(service)) {
    notFound();
  }

  return (
    <ApiReferenceReact
      configuration={{
        url: serviceSpecJsonUrl(service),
      }}
    />
  );
}
