import { createHash, randomBytes } from "node:crypto";

export function createRandomToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}
