const crypto = require("crypto");
const digilockerConfig = require("../config/digilocker.config");
const ApiError = require("../utils/ApiError");

// --- Signed OAuth state -----------------------------------------------------
// Carries the userId OR signupSessionId through the DigiLocker redirect without
// depending on session cookies, which can drop across cross-site redirects.
// Signed with HMAC-SHA256 so it can't be tampered with.

const generateState = (userId, { signupSessionId } = {}) => {
  const payload = {
    ts: Date.now(),
  };
  if (signupSessionId) {
    // Pre-account flow — no userId yet
    payload.signupSessionId = signupSessionId;
  } else {
    // Post-account flow — existing authenticated user
    payload.userId = userId ? userId.toString() : undefined;
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", digilockerConfig.hmacSecret)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
};

const verifyState = (state) => {
  if (!state || typeof state !== "string" || !state.includes(".")) {
    throw new ApiError(400, "Invalid or missing DigiLocker state parameter");
  }
  const [payloadB64, signature] = state.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", digilockerConfig.hmacSecret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new ApiError(400, "DigiLocker state signature mismatch — possible tampering");
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  if (Date.now() - payload.ts > digilockerConfig.stateMaxAgeMs) {
    throw new ApiError(400, "DigiLocker session expired — please retry verification");
  }
  return payload; // { userId?, signupSessionId?, ts }
};


// --- Authorization URL -------------------------------------------------------

const getAuthorizationUrl = (userId, { signupSessionId } = {}) => {
  const state = generateState(userId, { signupSessionId });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: digilockerConfig.clientId,
    redirect_uri: digilockerConfig.redirectUri,
    state,
  });
  if (digilockerConfig.scopes?.length) {
    params.set("scope", digilockerConfig.scopes.join(" "));
  }
  return {
    url: `${digilockerConfig.baseUrl}${digilockerConfig.authorizeEndpoint}?${params.toString()}`,
    state,
  };
};


// --- Token exchange -----------------------------------------------------------

const exchangeCodeForToken = async (code) => {
  if (digilockerConfig.mockMode) {
    return {
      access_token: `mock-access-token-${crypto.randomBytes(6).toString("hex")}`,
      digilocker_id: `mock-dl-${crypto.randomBytes(4).toString("hex")}`,
      expires_in: 3600,
    };
  }

  const res = await fetch(`${digilockerConfig.baseUrl}${digilockerConfig.tokenEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: digilockerConfig.clientId,
      client_secret: digilockerConfig.clientSecret,
      redirect_uri: digilockerConfig.redirectUri,
    }),
  });

  if (!res.ok) {
    throw new ApiError(502, "DigiLocker token exchange failed");
  }
  return res.json();
};

// --- Document retrieval --------------------------------------------------------
// TODO: verify against the API Setu Requester spec once sandbox access is live.
// e-Aadhaar and PAN are typically returned as signed XML; this fetches the raw
// issued-document list, then the content for each requested doc type, and does
// light parsing. Swap the naive regex parsing below for a proper XML parser
// (e.g. `xml2js`) once real document samples are available.

const fetchIssuedDocuments = async (accessToken) => {
  if (digilockerConfig.mockMode) {
    return [
      { doctype: "ADHAR", uri: "mock:aadhaar-uri", name: "Aadhaar Card" },
      { doctype: "PANCR", uri: "mock:pan-uri", name: "PAN Card" },
    ];
  }

  const res = await fetch(`${digilockerConfig.baseUrl}${digilockerConfig.issuedDocsEndpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new ApiError(502, "Failed to fetch DigiLocker document list");
  const data = await res.json();
  return data.items || [];
};

const fetchDocumentContent = async (accessToken, uri) => {
  if (digilockerConfig.mockMode) {
    if (uri === "mock:aadhaar-uri") {
      return `<Certificate><UidData name="RAHUL KUMAR" dob="1998-04-12" gender="M" /></Certificate>`;
    }
    if (uri === "mock:pan-uri") {
      return `<PanCard name="RAHUL KUMAR" panNumber="ABCPK1234L" dob="1998-04-12" />`;
    }
    return "";
  }

  const res = await fetch(
    `${digilockerConfig.baseUrl}${digilockerConfig.fileFetchEndpoint}/${encodeURIComponent(uri)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new ApiError(502, "Failed to fetch DigiLocker document content");
  return res.text();
};

// Naive XML attribute extraction — replace with a real XML parser before production use.
const extractAttr = (xml, attr) => {
  const match = xml.match(new RegExp(`${attr}="([^"]*)"`, "i"));
  return match ? match[1] : "";
};

const parseAadhaarXml = (xml) => ({
  name: extractAttr(xml, "name"),
  dob: extractAttr(xml, "dob"),
  gender: extractAttr(xml, "gender"),
});

const parsePanXml = (xml) => ({
  name: extractAttr(xml, "name"),
  dob: extractAttr(xml, "dob"),
  panNumber: extractAttr(xml, "panNumber"),
});

/**
 * Fetches and parses all consented documents for a user, returning a flat
 * extracted-data object plus the list of document types successfully verified.
 */
const retrieveAndParseDocuments = async (accessToken) => {
  const issued = await fetchIssuedDocuments(accessToken);
  const documentsVerified = [];
  const extractedData = { name: "", dob: "", gender: "", panNumber: "" };

  for (const doc of issued) {
    const type = (doc.doctype || "").toUpperCase();
    if (type === "ADHAR") {
      const xml = await fetchDocumentContent(accessToken, doc.uri);
      const parsed = parseAadhaarXml(xml);
      Object.assign(extractedData, {
        name: parsed.name || extractedData.name,
        dob: parsed.dob || extractedData.dob,
        gender: parsed.gender || extractedData.gender,
      });
      documentsVerified.push("aadhaar");
    } else if (type === "PANCR") {
      const xml = await fetchDocumentContent(accessToken, doc.uri);
      const parsed = parsePanXml(xml);
      Object.assign(extractedData, {
        name: parsed.name || extractedData.name,
        dob: parsed.dob || extractedData.dob,
        panNumber: parsed.panNumber || extractedData.panNumber,
      });
      documentsVerified.push("pan");
    }
  }

  return { extractedData, documentsVerified };
};

module.exports = {
  generateState,
  verifyState,
  getAuthorizationUrl,
  exchangeCodeForToken,
  retrieveAndParseDocuments,
};