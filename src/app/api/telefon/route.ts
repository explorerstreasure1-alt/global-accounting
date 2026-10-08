import { networkInterfaces } from "node:os";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** Wi-Fi üzerinden telefon bağlantısı: kablosuz IP + karekod. */
function kablosuzIp(): string {
  const aglar = networkInterfaces();
  // Önce 192.168.x.x / 10.x.x.x (ev/dükkân Wi-Fi'si), sonra ilk harici IPv4.
  const adaylar: string[] = [];
  for (const liste of Object.values(aglar)) {
    for (const ag of liste || []) {
      if (ag.family === "IPv4" && !ag.internal) adaylar.push(ag.address);
    }
  }
  return (
    adaylar.find((ip) => ip.startsWith("192.168.")) ??
    adaylar.find((ip) => ip.startsWith("10.")) ??
    adaylar.find((ip) => ip.startsWith("172.")) ??
    adaylar[0] ??
    "127.0.0.1"
  );
}

export async function GET() {
  const port = Number(process.env.PORT || 3001);
  const ip = kablosuzIp();
  const url = `http://${ip}:${port}/`;
  let qr: string | null = null;
  try {
    qr = await QRCode.toDataURL(url, { width: 240, margin: 1 });
  } catch {
    qr = null;
  }
  return Response.json({ ip, port, url, qr });
}
