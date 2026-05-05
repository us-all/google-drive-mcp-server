import { z } from "zod";
import { getDriveClient } from "../client.js";
import { getCapabilities } from "../capabilities.js";
import { requireGWS } from "./utils.js";

/**
 * `audit-shared-drive-permissions` — sampling-based permission audit for a Shared Drive.
 *
 * Walks up to `maxFiles` files (newest first) and tallies their permissions to surface
 * the things change-management actually cares about: anyone-with-link, external-domain
 * grants, files shared with very large groups, and the union of unique grantees.
 *
 * Designed for "pre-handoff" or "compliance spot-check" workflows. Sampling, not
 * exhaustive — the response carries the sample size and `caveats[]` if the cap was hit.
 *
 * GWS-only (Shared Drives don't exist on personal accounts).
 */

export const auditSharedDrivePermissionsSchema = z.object({
  driveId: z.string().describe("Shared Drive ID. Use list-shared-drives to discover IDs."),
  maxFiles: z.coerce.number().int().min(1).max(500).optional().default(100)
    .describe("Number of files to sample (newest first). Default 100, max 500."),
  highShareThreshold: z.coerce.number().int().min(2).optional().default(10)
    .describe("Files with permission count >= this value are flagged as 'high-share'. Default 10."),
  internalDomain: z.string().optional()
    .describe("Domain considered internal (e.g. 'us-all.co.kr'). When omitted, auto-detects from the authenticated GWS account."),
});

interface DrivePermission {
  id?: string | null;
  type?: string | null;
  role?: string | null;
  emailAddress?: string | null;
  displayName?: string | null;
  domain?: string | null;
}

interface DriveFile {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
  permissions?: DrivePermission[];
}

function classifyDomain(perm: DrivePermission, internalDomain: string | null): "internal" | "external" | "anyone" | "domain" | "unknown" {
  if (perm.type === "anyone") return "anyone";
  if (perm.type === "domain") return internalDomain && perm.domain === internalDomain ? "internal" : "domain";
  if (perm.type === "user" || perm.type === "group") {
    if (!perm.emailAddress) return "unknown";
    const at = perm.emailAddress.lastIndexOf("@");
    if (at < 0) return "unknown";
    const dom = perm.emailAddress.slice(at + 1).toLowerCase();
    return internalDomain && dom === internalDomain.toLowerCase() ? "internal" : "external";
  }
  return "unknown";
}

export async function auditSharedDrivePermissions(
  params: z.infer<typeof auditSharedDrivePermissionsSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Shared Drives");

  const internalDomain =
    params.internalDomain ?? (caps?.isGWS ? caps.domain ?? null : null);

  const drive = getDriveClient();
  const caveats: string[] = [];

  // Fetch the drive name once (best-effort).
  const driveMeta = await drive.drives
    .get({ driveId: params.driveId, fields: "id,name" })
    .then((r) => r.data)
    .catch((err) => {
      caveats.push(`drive metadata failed: ${err instanceof Error ? err.message : String(err)}`);
      return { id: params.driveId, name: null };
    });

  // Page through files until we have maxFiles or run out.
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  while (files.length < params.maxFiles) {
    const remaining = params.maxFiles - files.length;
    const resp = await drive.files
      .list({
        driveId: params.driveId,
        corpora: "drive",
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        orderBy: "modifiedTime desc",
        pageSize: Math.min(remaining, 100),
        pageToken,
        fields:
          "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,permissions(id,type,role,emailAddress,displayName,domain))",
      })
      .catch((err) => {
        caveats.push(`files.list page failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });
    if (!resp) break;
    for (const f of resp.data.files ?? []) files.push(f);
    if (!resp.data.nextPageToken) break;
    pageToken = resp.data.nextPageToken;
  }

  if (pageToken) caveats.push(`audit truncated at ${params.maxFiles} files (more available)`);

  const roleCounts: Record<string, number> = {};
  const classCounts = { internal: 0, external: 0, anyone: 0, domain: 0, unknown: 0 };
  const grantees = new Set<string>();
  const externalGrantees = new Set<string>();
  const filesAnyone: Array<{ id: string; name: string; webViewLink?: string | null }> = [];
  const filesExternal: Array<{ id: string; name: string; externalEmails: string[]; webViewLink?: string | null }> = [];
  const filesHighShare: Array<{ id: string; name: string; permissionCount: number; webViewLink?: string | null }> = [];

  for (const f of files) {
    const perms = f.permissions ?? [];
    if (perms.length >= params.highShareThreshold) {
      filesHighShare.push({
        id: f.id ?? "",
        name: f.name ?? "",
        permissionCount: perms.length,
        webViewLink: f.webViewLink ?? null,
      });
    }
    const externalEmailsForFile: string[] = [];
    let fileHasAnyone = false;
    for (const p of perms) {
      if (p.role) roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
      const cls = classifyDomain(p, internalDomain ?? null);
      classCounts[cls] += 1;
      if (cls === "anyone") fileHasAnyone = true;
      const key = p.emailAddress ?? p.domain ?? p.type ?? "unknown";
      grantees.add(key);
      if (cls === "external" && p.emailAddress) {
        externalGrantees.add(p.emailAddress);
        externalEmailsForFile.push(p.emailAddress);
      }
    }
    if (fileHasAnyone) {
      filesAnyone.push({ id: f.id ?? "", name: f.name ?? "", webViewLink: f.webViewLink ?? null });
    }
    if (externalEmailsForFile.length > 0) {
      filesExternal.push({
        id: f.id ?? "",
        name: f.name ?? "",
        externalEmails: [...new Set(externalEmailsForFile)],
        webViewLink: f.webViewLink ?? null,
      });
    }
  }

  return {
    drive: { id: driveMeta.id ?? params.driveId, name: driveMeta.name ?? null },
    summary: {
      filesAudited: files.length,
      maxFiles: params.maxFiles,
      truncated: !!pageToken,
      uniqueGrantees: grantees.size,
      externalGrantees: externalGrantees.size,
      anyoneWithLinkFiles: filesAnyone.length,
      externalFiles: filesExternal.length,
      highShareFiles: filesHighShare.length,
      internalDomain: internalDomain ?? null,
    },
    classCounts,
    roleCounts,
    findings: {
      anyoneWithLink: filesAnyone.slice(0, 25),
      externallyShared: filesExternal.slice(0, 25),
      highShare: filesHighShare.sort((a, b) => b.permissionCount - a.permissionCount).slice(0, 25),
    },
    caveats,
  };
}
