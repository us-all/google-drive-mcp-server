import { google, drive_v3, driveactivity_v2, drivelabels_v2, sheets_v4 } from "googleapis";
import { config } from "./config.js";

let driveClient: drive_v3.Drive | null = null;
let activityClient: driveactivity_v2.Driveactivity | null = null;
let labelsClient: drivelabels_v2.Drivelabels | null = null;
let sheetsClient: sheets_v4.Sheets | null = null;

function createAuth() {
  if (config.authMethod === "service-account") {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.serviceAccountKeyPath,
      scopes: config.scopes,
      clientOptions: config.impersonateUser
        ? { subject: config.impersonateUser }
        : undefined,
    });
    return auth;
  }

  if (config.authMethod === "adc" && config.adcCredentials) {
    const oauth2 = new google.auth.OAuth2(
      config.adcCredentials.clientId,
      config.adcCredentials.clientSecret,
    );
    oauth2.setCredentials({
      refresh_token: config.adcCredentials.refreshToken,
    });
    return oauth2;
  }

  const oauth2 = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
  );
  oauth2.setCredentials({
    refresh_token: config.refreshToken,
  });
  return oauth2;
}

export function getDriveClient(): drive_v3.Drive {
  if (!driveClient) {
    const auth = createAuth();
    driveClient = google.drive({ version: "v3", auth });
  }
  return driveClient;
}

export function getActivityClient(): driveactivity_v2.Driveactivity {
  if (!activityClient) {
    const auth = createAuth();
    activityClient = google.driveactivity({ version: "v2", auth });
  }
  return activityClient;
}

export function getLabelsClient(): drivelabels_v2.Drivelabels {
  if (!labelsClient) {
    const auth = createAuth();
    labelsClient = google.drivelabels({ version: "v2", auth });
  }
  return labelsClient;
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    const auth = createAuth();
    sheetsClient = google.sheets({ version: "v4", auth });
  }
  return sheetsClient;
}
