import { z } from "zod";
import { getDriveClient } from "../client.js";
import { getCapabilities } from "../capabilities.js";

// ── get-about ───────────────────────────────────────────────────────────────

export const getAboutSchema = z.object({});

export async function getAbout(_params: z.infer<typeof getAboutSchema>) {
  const drive = getDriveClient();

  const response = await drive.about.get({
    fields:
      "user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive,usageInDriveTrash),canCreateDrives,maxUploadSize,appInstalled",
  });

  const capabilities = getCapabilities();

  return {
    user: response.data.user,
    storageQuota: response.data.storageQuota
      ? {
          limit: response.data.storageQuota.limit
            ? `${(parseInt(response.data.storageQuota.limit) / 1024 / 1024 / 1024).toFixed(1)} GB`
            : "Unlimited",
          usage: `${(parseInt(response.data.storageQuota.usage ?? "0") / 1024 / 1024 / 1024).toFixed(2)} GB`,
          usageInDrive: `${(parseInt(response.data.storageQuota.usageInDrive ?? "0") / 1024 / 1024 / 1024).toFixed(2)} GB`,
          trash: `${(parseInt(response.data.storageQuota.usageInDriveTrash ?? "0") / 1024 / 1024 / 1024).toFixed(2)} GB`,
        }
      : null,
    canCreateSharedDrives: response.data.canCreateDrives,
    maxUploadSize: response.data.maxUploadSize,
    accountType: capabilities?.isGWS ? "Google Workspace" : "Personal",
    domain: capabilities?.domain,
    gwsCapabilities: capabilities
      ? {
          sharedDrives: capabilities.sharedDrives,
          labels: capabilities.labels,
          contentRestrictions: capabilities.contentRestrictions,
          driveActivity: capabilities.driveActivity,
        }
      : null,
  };
}
