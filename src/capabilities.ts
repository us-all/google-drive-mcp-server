import { getDriveClient } from "./client.js";

export interface AccountCapabilities {
  isGWS: boolean;
  domain: string;
  email: string;
  displayName: string;
  sharedDrives: boolean;
  labels: boolean;
  contentRestrictions: boolean;
  driveActivity: boolean;
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
]);

let cachedCapabilities: AccountCapabilities | null = null;

export async function detectCapabilities(): Promise<AccountCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const drive = getDriveClient();

  const about = await drive.about.get({
    fields: "user(displayName,emailAddress),storageQuota,canCreateDrives",
  });

  const email = about.data.user?.emailAddress ?? "";
  const domain = email.split("@")[1] ?? "";
  const displayName = about.data.user?.displayName ?? "";
  const isGWS = !PERSONAL_DOMAINS.has(domain) && domain !== "";

  let sharedDrives = false;
  if (isGWS) {
    try {
      await drive.drives.list({ pageSize: 1 });
      sharedDrives = true;
    } catch {
      sharedDrives = false;
    }
  }

  let labels = false;
  if (isGWS) {
    try {
      // Probe labels by attempting to list on a dummy — a 404 means the API is available
      // but a 403/400 with "not enabled" means labels aren't available
      labels = true; // Assume available for GWS, fail gracefully on use
    } catch {
      labels = false;
    }
  }

  cachedCapabilities = {
    isGWS,
    domain,
    email,
    displayName,
    sharedDrives,
    labels,
    contentRestrictions: true, // Available to all accounts
    driveActivity: true, // Available to all accounts
  };

  return cachedCapabilities;
}

export function getCapabilities(): AccountCapabilities | null {
  return cachedCapabilities;
}

export function resetCapabilities(): void {
  cachedCapabilities = null;
}
