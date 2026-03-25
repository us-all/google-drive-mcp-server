import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed } from "./utils.js";

// ── list-permissions ────────────────────────────────────────────────────────

export const listPermissionsSchema = z.object({
  fileId: z.string().describe("The ID of the file to list permissions for"),
});

export async function listPermissions(
  params: z.infer<typeof listPermissionsSchema>,
) {
  const drive = getDriveClient();

  const response = await drive.permissions.list({
    fileId: params.fileId,
    fields: "permissions(id,type,role,emailAddress,displayName,domain,expirationTime,pendingOwner)",
    supportsAllDrives: true,
  });

  return {
    permissions: response.data.permissions ?? [],
    count: response.data.permissions?.length ?? 0,
  };
}

// ── share-file ──────────────────────────────────────────────────────────────

export const shareFileSchema = z.object({
  fileId: z.string().describe("The ID of the file or folder to share"),
  type: z
    .enum(["user", "group", "domain", "anyone"])
    .describe(
      "Permission type. 'user': specific user, 'group': Google group, 'domain': entire domain, 'anyone': anyone with link",
    ),
  role: z
    .enum(["reader", "commenter", "writer", "fileOrganizer", "organizer", "owner"])
    .describe(
      "Permission role. 'reader', 'commenter', 'writer' are universal. 'fileOrganizer' and 'organizer' are for Shared Drives. 'owner' transfers ownership",
    ),
  emailAddress: z
    .string()
    .optional()
    .describe("Email address of the user or group. Required for type 'user' or 'group'"),
  domain: z
    .string()
    .optional()
    .describe("Domain name. Required for type 'domain'"),
  sendNotificationEmail: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to send a notification email. Default: true"),
  emailMessage: z
    .string()
    .optional()
    .describe("Custom message to include in the notification email"),
});

export async function shareFile(params: z.infer<typeof shareFileSchema>) {
  assertWriteAllowed();
  const drive = getDriveClient();

  const permission: Record<string, unknown> = {
    type: params.type,
    role: params.role,
  };

  if (params.emailAddress) permission.emailAddress = params.emailAddress;
  if (params.domain) permission.domain = params.domain;

  const createParams: Record<string, unknown> = {
    fileId: params.fileId,
    requestBody: permission,
    fields: "id,type,role,emailAddress,displayName",
    supportsAllDrives: true,
  };

  // sendNotificationEmail is only valid for 'user' or 'group' types
  if (params.type === "user" || params.type === "group") {
    createParams.sendNotificationEmail = params.sendNotificationEmail;
    if (params.emailMessage) createParams.emailMessage = params.emailMessage;
  }

  const response = await drive.permissions.create(createParams);

  return response.data;
}

// ── remove-permission ───────────────────────────────────────────────────────

export const removePermissionSchema = z.object({
  fileId: z.string().describe("The ID of the file"),
  permissionId: z
    .string()
    .describe("The ID of the permission to remove. Get this from list-permissions"),
});

export async function removePermission(
  params: z.infer<typeof removePermissionSchema>,
) {
  assertWriteAllowed();
  const drive = getDriveClient();

  await drive.permissions.delete({
    fileId: params.fileId,
    permissionId: params.permissionId,
    supportsAllDrives: true,
  });

  return {
    removed: true,
    fileId: params.fileId,
    permissionId: params.permissionId,
  };
}
