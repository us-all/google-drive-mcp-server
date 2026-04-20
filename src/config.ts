import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";

dotenv.config();

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.activity.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
];

const WRITE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.activity.readonly",
  "https://www.googleapis.com/auth/documents",
];

function parseScopes(): string[] {
  const raw = process.env.GOOGLE_DRIVE_SCOPES;
  if (!raw) {
    return config.allowWrite ? WRITE_SCOPES : DEFAULT_SCOPES;
  }
  return raw.split(",").map((s) =>
    s.trim().startsWith("https://")
      ? s.trim()
      : `https://www.googleapis.com/auth/${s.trim()}`
  );
}

export type AuthMethod = "oauth2" | "service-account" | "adc";

export interface AdcCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface Config {
  authMethod: AuthMethod;

  // OAuth2
  clientId: string;
  clientSecret: string;
  refreshToken: string;

  // Service Account
  serviceAccountKeyPath: string;
  impersonateUser: string;

  // ADC
  adcCredentials: AdcCredentials | null;

  // Options
  allowWrite: boolean;
  scopes: string[];
}

function findAdcFile(): string | null {
  // 1. GOOGLE_APPLICATION_CREDENTIALS env var
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2. gcloud default location (platform-specific)
  const candidates: string[] = [];

  // Windows: %APPDATA%\gcloud\application_default_credentials.json
  if (process.env.APPDATA) {
    candidates.push(
      path.join(process.env.APPDATA, "gcloud", "application_default_credentials.json"),
    );
  }

  // Unix/macOS: ~/.config/gcloud/application_default_credentials.json
  candidates.push(
    path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json"),
  );

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function loadAdcCredentials(): AdcCredentials | null {
  const adcPath = findAdcFile();
  if (!adcPath) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(adcPath, "utf-8"));
    if (raw.type === "authorized_user" && raw.client_id && raw.client_secret && raw.refresh_token) {
      return {
        clientId: raw.client_id,
        clientSecret: raw.client_secret,
        refreshToken: raw.refresh_token,
      };
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function detectAuthMethod(): AuthMethod {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    return "service-account";
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    return "oauth2";
  }
  // Fallback: try ADC
  if (loadAdcCredentials()) {
    return "adc";
  }
  return "oauth2";
}

export const config: Config = {
  authMethod: detectAuthMethod(),

  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",

  serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ?? "",
  impersonateUser: process.env.GOOGLE_IMPERSONATE_USER ?? "",

  adcCredentials: loadAdcCredentials(),

  allowWrite: process.env.GOOGLE_DRIVE_ALLOW_WRITE === "true",
  scopes: [],
};

// Scopes depend on allowWrite, so parse after config is created
config.scopes = parseScopes();

export function validateConfig(): void {
  if (config.authMethod === "oauth2") {
    if (!config.clientId) throw new Error("GOOGLE_CLIENT_ID is required for OAuth2 authentication");
    if (!config.clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is required for OAuth2 authentication");
    if (!config.refreshToken) throw new Error("GOOGLE_REFRESH_TOKEN is required for OAuth2 authentication");
  } else if (config.authMethod === "service-account") {
    if (!config.serviceAccountKeyPath) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_PATH is required for Service Account authentication");
    }
  } else if (config.authMethod === "adc") {
    if (!config.adcCredentials) {
      throw new Error("No Application Default Credentials found. Run 'gcloud auth application-default login' first.");
    }
  }
}
