import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/chat-widget";
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
    <div className="flex flex-col gap-6">
      <ApiReferenceReact
        configuration={{
          url: serviceSpecJsonUrl(service),
        }}
      />
      <div className="mx-auto w-full max-w-3xl px-6 pb-8">
        <ChatWidget serviceId={service} />
      </div>
    </div>
  );
}
