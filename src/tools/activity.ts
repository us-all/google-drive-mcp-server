import { z } from "zod";
import { getActivityClient } from "../client.js";

// ── get-activity ────────────────────────────────────────────────────────────

export const getActivitySchema = z.object({
  fileId: z
    .string()
    .optional()
    .describe("The ID of the file to get activity for. Either fileId or folderId must be provided"),
  folderId: z
    .string()
    .optional()
    .describe("The ID of the folder (ancestor) to get activity for"),
  pageSize: z.coerce
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of activity entries to return (1-50). Default: 10"),
  pageToken: z
    .string()
    .optional()
    .describe("Token for fetching the next page of results"),
  filter: z
    .string()
    .optional()
    .describe(
      "Activity filter. Examples: 'detail.action_detail_case: CREATE', 'detail.action_detail_case: EDIT', 'detail.action_detail_case: PERMISSION_CHANGE'",
    ),
});

export async function getActivity(
  params: z.infer<typeof getActivitySchema>,
) {
  const activity = getActivityClient();

  const requestBody: Record<string, unknown> = {
    pageSize: params.pageSize,
    pageToken: params.pageToken,
  };

  if (params.fileId) {
    requestBody.itemName = `items/${params.fileId}`;
  } else if (params.folderId) {
    requestBody.ancestorName = `items/${params.folderId}`;
  }

  if (params.filter) {
    requestBody.filter = params.filter;
  }

  const response = await activity.activity.query({
    requestBody,
  });

  const activities = (response.data.activities ?? []).map((a) => ({
    primaryAction: a.primaryActionDetail,
    actors: a.actors?.map((actor) => ({
      user: actor.user?.knownUser?.personName,
      email: actor.user?.knownUser?.personName,
    })),
    targets: a.targets?.map((target) => ({
      driveItem: target.driveItem
        ? {
            name: target.driveItem.name,
            title: target.driveItem.title,
            mimeType: target.driveItem.mimeType,
          }
        : undefined,
    })),
    timestamp: a.timestamp,
    timeRange: a.timeRange,
  }));

  return {
    activities,
    nextPageToken: response.data.nextPageToken,
    count: activities.length,
  };
}
