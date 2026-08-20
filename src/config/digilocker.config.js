// Centralized DigiLocker / API Setu configuration.
// All values are sourced from environment variables so nothing sensitive is hardcoded.
//
// Required .env additions:
//   DIGILOCKER_CLIENT_ID=your_client_id
//   DIGILOCKER_CLIENT_SECRET=your_client_secret
//   DIGILOCKER_REDIRECT_URI=http://localhost:5000/api/v1/kyc/digilocker/callback
//   DIGILOCKER_BASE_URL=https://api.digitallocker.gov.in
//   DIGILOCKER_HMAC_SECRET=your_secure_random_state_secret
//
// TODO: once ExpgloFund is approved as a DigiLocker Requester, confirm the exact
// authorize/token/document endpoint paths against the API Setu Requester spec —
// the paths below are the commonly documented ones but should be verified against
// your sandbox credentials before going live.

const required = (name, fallback = undefined) => {
  const val = process.env[name] ?? fallback;
  return val;
};

module.exports = {
  clientId: required("DIGILOCKER_CLIENT_ID"),
  clientSecret: required("DIGILOCKER_CLIENT_SECRET"),
  redirectUri: required("DIGILOCKER_REDIRECT_URI"),
  baseUrl: required("DIGILOCKER_BASE_URL", "https://api.digitallocker.gov.in"),
  hmacSecret: required("DIGILOCKER_HMAC_SECRET"),

  // API Setu / DigiLocker endpoint paths (verify against Requester docs before go-live)
  authorizeEndpoint: "/public/oauth2/1/authorize",
  tokenEndpoint: "/public/oauth2/1/token",
  issuedDocsEndpoint: "/public/oauth2/2/files/issued",
  fileFetchEndpoint: "/public/oauth2/1/file",

  // Document types ExpgloFund requests consent for during KYC
  scopes: ["aadhaar", "pan"],

  // Minimum name-similarity score (0-100) to auto-approve without human review
  matchThreshold: 85,

  // How long an OAuth state token remains valid
  stateMaxAgeMs: 10 * 60 * 1000, // 10 minutes

  // If true, DigiLocker calls are mocked with sample data instead of hitting the
  // real API. Useful for building/testing the rest of the flow before Requester
  // credentials are issued. Set DIGILOCKER_MOCK_MODE=false once credentials exist.
  mockMode: (process.env.DIGILOCKER_MOCK_MODE || "true").toLowerCase() === "true",
};