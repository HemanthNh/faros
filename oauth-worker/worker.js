const OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token";

function parseAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowed) {
  if (!origin) return false;
  if (!allowed.length) return false;
  return allowed.includes(origin);
}

function buildRedirect(url, params) {
  const target = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, value);
    }
  });
  return target.toString();
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

// Only accept fully qualified origins (scheme://host[:port])
function normalizeOrigin(candidate) {
  if (!candidate) return "";
  if (candidate.startsWith("http://") || candidate.startsWith("https://")) return candidate;
  return "";
}

// Try to derive an origin from request headers (may be empty for popup navigation)
function getOriginFromHeaders(request) {
  const origin = request.headers.get("Origin");
  if (origin) return origin;

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch (_) {
      // ignore
    }
  }
  return "";
}

async function handleAuth(request, env) {
  const url = new URL(request.url);

  const allowedOrigins = parseAllowedOrigins(env);

  // Decap may send:
  // - origin=<full origin> (sometimes)
  // - site_id=127.0.0.1 (hostname only, NOT a valid origin)
  // In popup top-level navigations, Origin/Referer headers may be missing.
  const headerOrigin = getOriginFromHeaders(request); // may be ""
  const originParam = normalizeOrigin(url.searchParams.get("origin")); // only if full origin
  const siteId = url.searchParams.get("site_id") || "";

  // Choose origin in priority order:
  // 1) origin query param (if it's a full origin)
  // 2) Origin/Referer headers (if present)
  // 3) local-dev fallback based on site_id for localhost/127.0.0.1
  let origin = originParam || headerOrigin;

  if (!origin && (siteId === "127.0.0.1" || siteId === "localhost")) {
    // Set this in Cloudflare Worker env vars for local dev:
    // LOCAL_DEV_ORIGIN = http://127.0.0.1:5500 (or whatever you use)
    origin = normalizeOrigin(env.LOCAL_DEV_ORIGIN) || "";
  }

  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return jsonResponse(
      {
        error: "Origin not allowed.",
        debug: {
          origin,
          site_id: siteId,
          originParamPresent: !!originParam,
          headerOriginPresent: !!headerOrigin,
          allowedOrigins,
          hint:
            "Set ALLOWED_ORIGINS to the exact site origin (e.g., http://127.0.0.1:5500). " +
            "For local dev, also set LOCAL_DEV_ORIGIN to the same full origin.",
        },
      },
      400
    );
  }

  const redirectUri = new URL("/callback", url.origin).toString();
  const state = encodeURIComponent(origin);

  const authorizeUrl = buildRedirect(OAUTH_AUTHORIZE_URL, {
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: url.searchParams.get("scope") || "repo",
    allow_signup: "false",
  });

  return Response.redirect(authorizeUrl, 302);
}

async function exchangeCodeForToken(code, env) {
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
  });

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch access token.");
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("No access token returned.");
  }

  return data.access_token;
}

function buildTokenResponseHtml(token, origin) {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Authorization</title>
</head>
<body>
  <script>
    (function() {
      var token = ${JSON.stringify(token)};
      var origin = ${JSON.stringify(origin)};
      var payload = { token: token, provider: "github" };

      // Step 1: handshake (Decap expects this)
      if (window.opener) {
        window.opener.postMessage("authorizing:github", origin || "*");
      }

      // Step 2: success message (Decap expects this exact prefix format)
      setTimeout(function() {
        if (window.opener) {
          window.opener.postMessage(
            "authorization:github:success:" + JSON.stringify(payload),
            origin || "*"
          );
        }
        window.close();
      }, 100);
    })();
  </script>
  Authorization complete. You may close this window.
</body>
</html>`;
}


async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const origin = decodeURIComponent(state); // should be full origin like http://127.0.0.1:5500
  const allowedOrigins = parseAllowedOrigins(env);

  if (!code) {
    return jsonResponse({ error: "Missing code." }, 400);
  }

  if (!isAllowedOrigin(origin, allowedOrigins)) {
    return jsonResponse(
      {
        error: "Origin not allowed.",
        debug: { origin, allowedOrigins, hint: "Ensure ALLOWED_ORIGINS includes the decoded state origin." },
      },
      400
    );
  }

  try {
    const token = await exchangeCodeForToken(code, env);
    return htmlResponse(buildTokenResponseHtml(token, origin));
  } catch (error) {
    return jsonResponse({ error: error.message || "OAuth error." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth") {
      return handleAuth(request, env);
    }
    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }
    return jsonResponse({ error: "Not found." }, 404);
  },
};
