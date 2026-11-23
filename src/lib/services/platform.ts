import { serverTimestamp, setDoc } from "firebase/firestore";
import type { PlatformSettings, UserProfile } from "@/types";
import { refs } from "./refs";
import { logAudit } from "./audit";

/** Super admin: update platform-wide settings (settings/platform). */
export async function updatePlatformSettings(patch: Pick<PlatformSettings, "aiAssistantEnabled">, actor: UserProfile) {
  await setDoc(
    refs.platformSettings(),
    { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.uid },
    { merge: true },
  );
  await logAudit(
    "settings.updated",
    { type: "settings", id: "platform", label: "Platform settings" },
    `${patch.aiAssistantEnabled ? "Enabled" : "Disabled"} the AI study assistant for all learners`,
  );
}
