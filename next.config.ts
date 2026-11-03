import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "pg"],
  allowedDevOrigins: ["127.0.0.1"],
  // PDF üretimi gömülü fontu okur; sunucusuz fonksiyon paketine dahil edilmeli.
  outputFileTracingIncludes: {
    "/api/pdf": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
