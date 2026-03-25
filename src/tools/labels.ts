import { z } from "zod";
import { getDriveClient } from "../client.js";
import { assertWriteAllowed, requireGWS } from "./utils.js";
import { getCapabilities } from "../capabilities.js";

// ── list-file-labels ────────────────────────────────────────────────────────

export const listFileLabelsSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to list labels for"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(20)
    .describe("Maximum number of labels to return. Default: 20"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
});

export async function listFileLabels(
  params: z.infer<typeof listFileLabelsSchema>,
) {
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Drive Labels");

  const drive = getDriveClient();

  const response = await drive.files.listLabels({
    fileId: params.fileId,
    maxResults: params.pageSize,
    pageToken: params.pageToken,
  });

  return {
    labels: response.data.labels ?? [],
    nextPageToken: response.data.nextPageToken,
    count: response.data.labels?.length ?? 0,
  };
}

// ── apply-label ─────────────────────────────────────────────────────────────

export const applyLabelSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to apply the label to"),
  labelId: z
    .string()
    .describe("The ID of the label to apply"),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Label field values as key-value pairs. Keys are field IDs, values depend on field type (text, integer, dateString, selection, user)",
    ),
});

export async function applyLabel(params: z.infer<typeof applyLabelSchema>) {
  assertWriteAllowed();
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Drive Labels");

  const drive = getDriveClient();

  const labelModification: Record<string, unknown> = {
    labelId: params.labelId,
    kind: "drive#labelModification",
  };

  if (params.fields) {
    labelModification.fieldModifications = Object.entries(params.fields).map(
      ([fieldId, value]) => ({
        fieldId,
        setValues: Array.isArray(value) ? value : [value],
      }),
    );
  }

  const response = await drive.files.modifyLabels({
    fileId: params.fileId,
    requestBody: {
      labelModifications: [labelModification],
    },
  });

  return response.data;
}

// ── remove-label ────────────────────────────────────────────────────────────

export const removeLabelSchema = z.object({
  fileId: z
    .string()
    .describe("The ID of the file to remove the label from"),
  labelId: z
    .string()
    .describe("The ID of the label to remove"),
});

export async function removeLabel(
  params: z.infer<typeof removeLabelSchema>,
) {
  assertWriteAllowed();
  const caps = getCapabilities();
  if (caps) requireGWS(caps, "Drive Labels");

  const drive = getDriveClient();

  const response = await drive.files.modifyLabels({
    fileId: params.fileId,
    requestBody: {
      labelModifications: [
        {
          labelId: params.labelId,
          kind: "drive#labelModification",
          removeLabel: true,
        },
      ],
    },
  });

  return response.data;
}
