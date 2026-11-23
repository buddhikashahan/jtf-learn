import { ExternalLink, FileText } from "lucide-react";
import { formatBytes, formatDateTime, safeExternalUrl } from "@/lib/utils";
import type { Submission } from "@/types";

export function SubmissionFile({ submission }: { submission: Submission }) {
  const href = safeExternalUrl(submission.fileUrl);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-surface px-3 py-2">
      <FileText className="size-4 shrink-0 text-brand-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{submission.fileName}</p>
        <p className="text-xs text-slate-500">
          {formatBytes(submission.fileSize)} · Submitted {formatDateTime(submission.submittedAt)}
        </p>
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Open <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
