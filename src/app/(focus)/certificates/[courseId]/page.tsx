import type { Metadata } from "next";
import { CertificateView } from "@/components/learn/certificate-view";

// Rendered behind the client-side AuthGuard (see layout).
export const instant = false;
export const metadata: Metadata = { title: "Certificate" };

export default function CertificatePage({ params }: PageProps<"/certificates/[courseId]">) {
  return <CertificateView params={params} />;
}
