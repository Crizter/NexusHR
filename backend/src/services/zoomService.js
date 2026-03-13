import User from "../models/User.models.js";

const ZOOM_CLIENT_ID     = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

// ─── Helper — Base64 Basic Auth header ───────────────────────────────────────
const basicAuthHeader = () =>
  "Basic " +
  Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

// ─── 1. Token Refresh Utility ─────────────────────────────────────────────────
/**
 * Checks if the user's Zoom access token is expired.
 * If not expired  — returns the existing access token immediately.
 * If expired      — refreshes via Zoom OAuth, persists new tokens to MongoDB,
 *                   and returns the new access token.
 *
 * @param   {import('mongoose').Document} user  - Mongoose User document
 * @returns {Promise<string>}                   - Valid Zoom access token
 */
export const refreshZoomTokenIfExpired = async (user) => {
  // ── Guard — zoomAuth must exist ───────────────────────────────────────────
  if (!user?.zoomAuth?.accessToken) {
    throw new Error(`User ${user._id} does not have Zoom connected.`);
  }

  const isExpired = new Date(user.zoomAuth.expiresAt) < new Date();

  // ── Token is still valid — return immediately ─────────────────────────────
  if (!isExpired) {
    console.log(`[zoomService] Token valid for user ${user._id} — skipping refresh.`);
    return user.zoomAuth.accessToken;
  }

  // ── Token is expired — refresh it ─────────────────────────────────────────
  console.log(`[zoomService] Token expired for user ${user._id} — refreshing...`);

  const tokenParams = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: user.zoomAuth.refreshToken,
  });

  const tokenResponse = await fetch("https://zoom.us/oauth/token", {
    method:  "POST",
    headers: {
      "Authorization": basicAuthHeader(),
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.json().catch(() => ({}));
    console.error("[zoomService] Token refresh failed:", errBody);
    throw new Error(
      `Zoom token refresh failed: ${errBody.reason ?? errBody.message ?? tokenResponse.status}`
    );
  }

  const {
    access_token,
    refresh_token,
    expires_in,
  } = await tokenResponse.json();

  const expiresAt = new Date(Date.now() + expires_in * 1000);

  // ── Persist refreshed tokens to MongoDB ───────────────────────────────────
  await User.findByIdAndUpdate(user._id, {
    $set: {
      "zoomAuth.accessToken":  access_token,
      "zoomAuth.refreshToken": refresh_token,
      "zoomAuth.expiresAt":    expiresAt,
    },
  });

  console.log(
    `[zoomService] Token refreshed for user ${user._id} | expires at ${expiresAt.toISOString()}`
  );

  return access_token;
};

// ─── 2. Meeting Scheduler Utility ─────────────────────────────────────────────
/**
 * Creates a scheduled Zoom meeting on behalf of the HR recruiter.
 * Automatically refreshes the access token if it is expired.
 *
 * @param   {string} userId     - MongoDB _id of the HR User (recruiter)
 * @param   {string} topic      - Meeting title / interview label
 * @param   {string} startTime  - ISO 8601 string e.g. "2026-04-01T10:00:00Z"
 * @param   {number} duration   - Duration in minutes e.g. 45
 * @returns {Promise<{
 *   meetingId:  number,
 *   topic:      string,
 *   startTime:  string,
 *   duration:   number,
 *   joinUrl:    string,   <- send to the candidate
 *   startUrl:   string,   <- send to the recruiter (host)
 *   password:   string,
 * }>}
 */
export const createZoomMeeting = async (userId, topic, startTime, duration) => {
  // ── Fetch the HR user ─────────────────────────────────────────────────────
  const user = await User.findById(userId).select("+zoomAuth");

  if (!user) {
    throw new Error(`User ${userId} not found.`);
  }

  if (!user.zoomAuth?.accessToken) {
    throw new Error(
      `User ${userId} has not connected their Zoom account. ` +
      `Please connect Zoom in Organization Settings > Integrations.`
    );
  }

  // ── Ensure a valid access token (refresh if expired) ─────────────────────
  const accessToken = await refreshZoomTokenIfExpired(user);

  // ── Build Zoom meeting payload ────────────────────────────────────────────
  const meetingPayload = {
    type:       2,               // 2 = Scheduled meeting
    topic,
    start_time: startTime,       // ISO 8601 — Zoom accepts this format
    duration,                    // minutes
    timezone:   "UTC",
    settings: {
      waiting_room:       true,  // host must admit each participant
      join_before_host:   false, // candidate cannot join until recruiter is present
      jbh_time:           0,     // irrelevant when join_before_host is false — explicit
      auto_recording:     "none",
      meeting_authentication: false,
    },
  };

  // ── POST to Zoom API ──────────────────────────────────────────────────────
  const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(meetingPayload),
  });

  if (!meetingResponse.ok) {
    const errBody = await meetingResponse.json().catch(() => ({}));
    console.error("[zoomService] Meeting creation failed:", errBody);
    throw new Error(
      `Zoom meeting creation failed: ${errBody.message ?? meetingResponse.status}`
    );
  }

  const meeting = await meetingResponse.json();

  console.log(
    `[zoomService] Meeting created | id=${meeting.id} | topic="${topic}" | ` +
    `start=${startTime} | duration=${duration}min | userId=${userId}`
  );

  // ── Return only what the controller needs ─────────────────────────────────
  return {
    meetingId:  meeting.id,
    topic:      meeting.topic,
    startTime:  meeting.start_time,
    duration:   meeting.duration,
    joinUrl:    meeting.join_url,    // send to the candidate
    startUrl:   meeting.start_url,   // send to the recruiter (host link — keep private)
    password:   meeting.password,
  };
};