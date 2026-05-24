/**
 * One-time script to get a Google OAuth refresh token for Calendar API access.
 * Run: npx ts-node scripts/google-auth.ts
 *
 * Prerequisites:
 * 1. Google Cloud project with Calendar API enabled
 * 2. OAuth 2.0 credentials (Web Application type)
 *    - Authorized redirect URI: http://localhost:4567/callback
 * 3. Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *
 * After running: copy the printed GOOGLE_REFRESH_TOKEN into .env.local
 */

import http from "http";
import { exec } from "child_process";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:4567/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\nOpening browser for Google OAuth consent...");
console.log("If browser doesn't open, visit:\n", authUrl, "\n");

// Try to open browser
exec(`open "${authUrl}"`);

// Start local server to capture callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:4567`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("No code in callback.");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h2>Auth successful! You can close this tab.</h2>");

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n✅ Success! Add this to your .env.local:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`\nAccess token (expires): ${tokens.access_token?.slice(0, 20)}...`);
  } catch (err) {
    console.error("Token exchange failed:", err);
  }

  server.close();
});

server.listen(4567, () => {
  console.log("Waiting for OAuth callback on http://localhost:4567/callback ...");
});
