/**
 * Apple "Sign in with Apple" 클라이언트 시크릿(JWT) 생성기.
 *
 * 사용법 (환경변수 또는 인자):
 *   APPLE_TEAM_ID=XXXXXXXXXX \
 *   APPLE_KEY_ID=YYYYYYYYYY \
 *   APPLE_CLIENT_ID=com.your.serviceid \
 *   APPLE_P8_PATH=./AuthKey_YYYYYYYYYY.p8 \
 *   node scripts/generate-apple-secret.mjs
 *
 * 출력된 JWT 를 AUTH_APPLE_SECRET 에, Services ID 를 AUTH_APPLE_ID 에 넣으세요.
 * (JWT 는 최대 6개월 유효 → 만료 전 재발급 필요)
 */
import crypto from "node:crypto";
import fs from "node:fs";

const teamId = process.env.APPLE_TEAM_ID || process.argv[2];
const keyId = process.env.APPLE_KEY_ID || process.argv[3];
const clientId = process.env.APPLE_CLIENT_ID || process.argv[4];
const p8Path = process.env.APPLE_P8_PATH || process.argv[5];

if (!teamId || !keyId || !clientId || !p8Path) {
  console.error(
    "필수값 누락. 사용법:\n  APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_P8_PATH 를 지정하세요."
  );
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: keyId };
const payload = {
  iss: teamId,
  iat: now,
  exp: now + 60 * 60 * 24 * 180, // 180일
  aud: "https://appleid.apple.com",
  sub: clientId,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const privateKey = fs.readFileSync(p8Path, "utf8");
const signature = crypto.sign("sha256", Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: "ieee-p1363", // JOSE(R||S) 형식
});
const jwt = `${signingInput}.${signature
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")}`;

console.log(jwt);
