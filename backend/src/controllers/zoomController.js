import User from "../models/User.models.js";

const ZOOM_CLIENT_ID     = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI  = process.env.ZOOM_REDIRECT_URI;
const CLIENT_URL         = process.env.CLIENT_URL ?? "http://localhost:5173";

// ─── Helper — Base64 Basic Auth header ───────────────────────────────────────
const basicAuthHeader = () =>
  "Basic " +
  Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

// ─── GET /api/zoom/auth  (protected — HR/Admin only) ─────────────────────────
export const getZoomAuthUrl = (req, res) => {
  try {
    //  Pass the logged-in user's MongoDB _id as `state`
    // The callback has no JWT — this is the only way to identify who to update
    const state = req.user.id.toString();

    const params = new URLSearchParams({
      response_type: "code",
      client_id:     ZOOM_CLIENT_ID,
      redirect_uri:  ZOOM_REDIRECT_URI,
      state,
    });

    const authUrl = `https://zoom.us/oauth/authorize?${params.toString()}`;

    return res.status(200).json({ success: true, url: authUrl });
  } catch (error) {
    console.error("[zoomController] getZoomAuthUrl error:", error);
    return res.status(500).json({ message: "Failed to generate Zoom auth URL." });
  }
};

// ─── GET /api/zoom/callback  (public — called by Zoom, not the browser) ──────
export const zoomCallback = async (req, res) => {
  const { code, state: userId, error: zoomError } = req.query;

  // ── Handle Zoom access denied / errors ────────────────────────────────────
  if (zoomError) {
    console.warn("[zoomController] Zoom OAuth denied:", zoomError);
    return res.redirect(
      `${CLIENT_URL}/dashboard/settings?zoom=error&reason=${encodeURIComponent(zoomError)}`
    );
  }

  if (!code || !userId) {
    console.warn("[zoomController] Missing code or state in callback.");
    return res.redirect(`${CLIENT_URL}/dashboard/settings?zoom=error&reason=missing_params`);
  }

  try {
    // ── Step 1: Exchange authorization code for tokens ─────────────────────
    const tokenParams = new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: ZOOM_REDIRECT_URI,
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
      console.error("[zoomController] Token exchange failed:", errBody);
      return res.redirect(
        `${CLIENT_URL}/dashboard/settings?zoom=error&reason=token_exchange_failed`
      );
    }

    const {
      access_token,
      refresh_token,
      expires_in,     // seconds from now
    } = await tokenResponse.json();

    // ── Step 2: Fetch Zoom user profile to get their Zoom user ID ──────────
    const profileResponse = await fetch("https://api.zoom.us/v2/users/me", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type":  "application/json",
      },
    });

    if (!profileResponse.ok) {
      const errBody = await profileResponse.json().catch(() => ({}));
      console.error("[zoomController] Zoom profile fetch failed:", errBody);
      return res.redirect(
        `${CLIENT_URL}/dashboard/settings?zoom=error&reason=profile_fetch_failed`
      );
    }

    const { id: zoomUserId, email: zoomEmail } = await profileResponse.json();

    // ── Step 3: Persist tokens to the User document ────────────────────────
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "zoomAuth.accessToken":  access_token,
          "zoomAuth.refreshToken": refresh_token,
          "zoomAuth.expiresAt":    expiresAt,
          "zoomAuth.zoomUserId":   zoomUserId,
        },
      },
      { returnDocument: "after" }    //  Mongoose 7+ — not { new: true }
    );

    if (!updatedUser) {
      console.error(`[zoomController] User ${userId} not found when saving Zoom tokens.`);
      return res.redirect(
        `${CLIENT_URL}/dashboard/settings?zoom=error&reason=user_not_found`
      );
    }

    console.log(
      `[zoomController] Zoom connected for user ${userId} | zoomUserId=${zoomUserId} | email=${zoomEmail}`
    );

    // ── Step 4: Redirect back to frontend settings page ────────────────────
    return res.redirect(`${CLIENT_URL}/dashboard/settings?zoom=success`);

  } catch (error) {
    console.error("[zoomController] zoomCallback unexpected error:", error);
    return res.redirect(
      `${CLIENT_URL}/dashboard/settings?zoom=error&reason=server_error`
    );
  }
};

// ─── GET /api/zoom/status  (protected — check if Zoom is connected) ───────────
export const getZoomStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("zoomAuth")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isConnected = !!user.zoomAuth?.accessToken;
    const isExpired   = isConnected
      ? new Date(user.zoomAuth.expiresAt) < new Date()
      : null;

    return res.status(200).json({
      success:     true,
      isConnected,
      isExpired,
      zoomUserId:  user.zoomAuth?.zoomUserId   ?? null,
      expiresAt:   user.zoomAuth?.expiresAt    ?? null,
    });
  } catch (error) {
    console.error("[zoomController] getZoomStatus error:", error);
    return res.status(500).json({ message: "Failed to fetch Zoom status." });
  }
};

// ─── DELETE /api/zoom/disconnect  (protected — revoke & clear tokens) ────────
export const disconnectZoom = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("zoomAuth").lean();

    if (!user?.zoomAuth?.accessToken) {
      return res.status(400).json({ message: "Zoom is not connected." });
    }

    // ── Revoke the token on Zoom's side ────────────────────────────────────
    const revokeParams = new URLSearchParams({
      token: user.zoomAuth.accessToken,
    });

    // Fire-and-forget — don't block disconnect if Zoom revoke fails
    fetch("https://zoom.us/oauth/revoke", {
      method:  "POST",
      headers: {
        "Authorization": basicAuthHeader(),
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: revokeParams.toString(),
    }).catch(err =>
      console.warn("[zoomController] Zoom token revoke failed (non-fatal):", err.message)
    );

    // ── Clear tokens from DB regardless of revoke result ──────────────────
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { zoomAuth: "" },
    });

    console.log(`[zoomController] Zoom disconnected for user ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Zoom account disconnected successfully.",
    });
  } catch (error) {
    console.error("[zoomController] disconnectZoom error:", error);
    return res.status(500).json({ message: "Failed to disconnect Zoom." });
  }
};