import { statSync } from "node:fs";
try {
  const ageMs = Date.now() - statSync("/tmp/oka-worker-heartbeat").mtimeMs;
  if (ageMs > 60_000) process.exit(1);
  process.exit(0);
} catch {
  process.exit(1);
}
