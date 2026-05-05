import { z } from "zod";
import { getDriveClient } from "../client.js";
import { getCapabilities } from "../capabilities.js";

/**
 * `audit-external-shares` — cross-drive external-share audit (My Drive +,
 * with corpora='allDrives', everything visible to the caller). Complements
 * `audit-shared-drive-permissions` which scopes to ONE Shared Drive at a time.
 *
 * Walks up to `maxFiles` files (newest first), tallies anyone-with-link grants,
 * external-domain shares, and high-share files (>= `highShareThreshold` perms).
 * Auto-detects the internal domain from the GWS account when not specified.
 *
 * Useful for "which of my files are exposed externally?" / pre-handoff cleanup
 * sweeps. Works for personal accounts (corpora='user' only).
 */

export const auditExternalSharesSchema = z.object({
  corpora: z.enum(["user", "allDrives"]).optional().default("user")
    .describe("Scope. 'user' = My Drive only (works for personal accounts). 'allDrives' = everything visible (My Drive + Shared Drives + Shared with me — GWS only)."),
  maxFiles: z.coerce.number().int().min(1).max(1000).optional().default(200)
    .describe("Number of files to sample (newest first). Default 200, max 1000."),
  highShareThreshold: z.coerce.number().int().min(2).optional().default(10)
    .describe("Files with permission count >= this value are flagged as 'high-share'. Default 10."),
  internalDomain: z.string().optional()
    .describe("Domain considered internal (e.g. 'us-all.co.kr'). When omitted, auto-detects from the authenticated GWS account; for personal accounts, every email-bearing grantee is treated as 'external' unless this is set."),
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
  driveId?: string | null;
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

export async function auditExternalShares(params: z.infer<typeof auditExternalSharesSchema>) {
  const caps = getCapabilities();
  // corpora=allDrives requires GWS — fail early with a clear message instead of
  // letting Drive return a generic 403.
  if (params.corpora === "allDrives" && caps && !caps.isGWS) {
    throw new Error("corpora='allDrives' requires a Google Workspace account. Use corpora='user' for personal accounts.");
  }

  const internalDomain =
    params.internalDomain ?? (caps?.isGWS ? caps.domain ?? null : null);

  const drive = getDriveClient();
  const caveats: string[] = [];

  if (!internalDomain) {
    caveats.push(
      "internalDomain not detected — every email grantee will be classified as 'external'. Set internalDomain explicitly for accurate audit on personal accounts.",
    );
  }

  // Page through files until we have maxFiles or run out.
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  while (files.length < params.maxFiles) {
    const remaining = params.maxFiles - files.length;
    const resp = await drive.files
      .list({
        corpora: params.corpora,
        includeItemsFromAllDrives: params.corpora === "allDrives",
        supportsAllDrives: true,
        orderBy: "modifiedTime desc",
        pageSize: Math.min(remaining, 100),
        pageToken,
        fields:
          "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,driveId,permissions(id,type,role,emailAddress,displayName,domain))",
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
  const externalDomains = new Map<string, number>(); // domain → file count
  const filesAnyone: Array<{ id: string; name: string; webViewLink?: string | null; driveId?: string | null }> = [];
  const filesExternal: Array<{ id: string; name: string; externalEmails: string[]; webViewLink?: string | null; driveId?: string | null }> = [];
  const filesHighShare: Array<{ id: string; name: string; permissionCount: number; webViewLink?: string | null; driveId?: string | null }> = [];

  for (const f of files) {
    const perms = f.permissions ?? [];
    if (perms.length >= params.highShareThreshold) {
      filesHighShare.push({
        id: f.id ?? "",
        name: f.name ?? "",
        permissionCount: perms.length,
        webViewLink: f.webViewLink ?? null,
        driveId: f.driveId ?? null,
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
        const at = p.emailAddress.lastIndexOf("@");
        if (at >= 0) {
          const dom = p.emailAddress.slice(at + 1).toLowerCase();
          externalDomains.set(dom, (externalDomains.get(dom) ?? 0) + 1);
        }
      }
    }
    if (fileHasAnyone) {
      filesAnyone.push({
        id: f.id ?? "",
        name: f.name ?? "",
        webViewLink: f.webViewLink ?? null,
        driveId: f.driveId ?? null,
      });
    }
    if (externalEmailsForFile.length > 0) {
      filesExternal.push({
        id: f.id ?? "",
        name: f.name ?? "",
        externalEmails: [...new Set(externalEmailsForFile)],
        webViewLink: f.webViewLink ?? null,
        driveId: f.driveId ?? null,
      });
    }
  }

  // Top external domains (by file count) — useful for spotting concentration risk.
  const topExternalDomains = [...externalDomains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, files: count }));

  return {
    scope: { corpora: params.corpora, internalDomain: internalDomain ?? null },
    summary: {
      filesAudited: files.length,
      maxFiles: params.maxFiles,
      truncated: !!pageToken,
      uniqueGrantees: grantees.size,
      externalGrantees: externalGrantees.size,
      externalDomainsCount: externalDomains.size,
      anyoneWithLinkFiles: filesAnyone.length,
      externalFiles: filesExternal.length,
      highShareFiles: filesHighShare.length,
    },
    classCounts,
    roleCounts,
    topExternalDomains,
    findings: {
      anyoneWithLink: filesAnyone.slice(0, 25),
      externallyShared: filesExternal.slice(0, 25),
      highShare: filesHighShare.sort((a, b) => b.permissionCount - a.permissionCount).slice(0, 25),
    },
    caveats,
  };
}
