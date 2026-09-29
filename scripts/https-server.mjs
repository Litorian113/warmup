// Serves the production build over HTTPS on 0.0.0.0, so the app can be opened from another
// machine (e.g. over Tailscale). Browsers only allow the microphone on https or localhost.
// A self-signed certificate is generated on first run: accept the browser warning once.
//
//   npm run build && npm run start:https        (PORT defaults to 3443)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:https";
import next from "next";

const port = Number(process.env.PORT ?? 3443);
const dir = "certs";
if (!existsSync(`${dir}/key.pem`)) {
  mkdirSync(dir, { recursive: true });
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "60",
    "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`,
    "-subj", "/CN=warmup-dev",
    "-addext", "subjectAltName=DNS:localhost,DNS:devbox,IP:127.0.0.1",
  ], { stdio: "ignore" });
}

const app = next({ dev: false });
const handle = app.getRequestHandler();
await app.prepare();
createServer({ key: readFileSync(`${dir}/key.pem`), cert: readFileSync(`${dir}/cert.pem`) }, (req, res) => handle(req, res)).listen(
  port,
  "0.0.0.0",
  () => console.log(`Warmup is running on https://0.0.0.0:${port} (self-signed certificate: accept the browser warning once).`),
);
