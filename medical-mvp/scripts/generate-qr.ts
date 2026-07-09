import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (const a of args) {
    const [k, v] = a.split("=");
    if (k && v) out[k.replace(/^--/, "")] = v;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const base = args.base || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const route = args.path || "/";
  const url = `${base}${route}`;

  const dir = path.join(process.cwd(), "public", "qr");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = (route.replaceAll("/", "_") || "home") + ".png";
  const outPath = path.join(dir, fileName);

  await QRCode.toFile(outPath, url, {
    width: 512,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#f8fafc",
    },
  });
  console.log("QR generated:", outPath, "->", url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
