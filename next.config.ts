import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "better-sqlite3", "mammoth", "exceljs"],
  devIndicators: false,
};

export default nextConfig;
