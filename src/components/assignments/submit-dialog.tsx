"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, Textarea } from "@/components/ui/form";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Alert } from "@/components/ui/feedback";
import { useProfile } from "@/components/providers/auth-provider";
import { submitAssignment } from "@/lib/services/assignments";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, toDate } from "@/lib/utils";
import { useNow } from "@/hooks/use-lms";
import type { Assignment, Submission, WithId } from "@/types";

export function SubmitDialog({
  open,
  onOpenChange,
  assignment,
  existing,
  instructorIds = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: WithId<Assignment>;
  existing: Submission | null;
  instructorIds?: string[];
}) {
  const profile = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const busy = progress !== null;
  const now = useNow();
  const late = (toDate(assignment.dueAt)?.getTime() ?? Infinity) < now;

  async function handleSubmit() {
    if (!file) return;
    setProgress(0);
    try {
      await submitAssignment({ assignment, profile, file, note, existing, instructorIds, onProgress: setProgress });
      toast.success(existing ? "Submission updated" : "Assignment submitted");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setProgress(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Resubmit assignment" : "Submit assignment"}
      description={`${assignment.title} · Due ${formatDateTime(assignment.dueAt)}`}
      dismissible={!busy}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!file} loading={busy}>
            <Send /> {existing ? "Replace submission" : "Submit"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {late && (
          <Alert tone="warning" title="The due date has passed">
            Your submission will be marked as late.
          </Alert>
        )}
        {existing && (
          <Alert tone="info">
            Uploading a new file will replace <span className="font-medium">{existing.fileName}</span>.
          </Alert>
        )}
        <FileDropzone
          kind="submission"
          file={file}
          onFileChange={setFile}
          progress={progress}
          disabled={busy}
          hint="PDF, Word, Excel, PowerPoint, images or ZIP — up to 20 MB"
        />
        <FormField label="Note to instructor (optional)">
          <Textarea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything your instructor should know?"
            disabled={busy}
          />
        </FormField>
      </div>
    </Dialog>
  );
}
