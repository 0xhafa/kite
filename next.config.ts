import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  distDir: process.env.KITE_E2E === "1" ? ".next/e2e" : ".next",
  // Workflow's Vercel runtime loads these packages dynamically. Keeping them
  // external also avoids evaluating the CLI config path during Next's build.
  serverExternalPackages: ["@vercel/oidc", "ajv", "xdg-app-paths"],
};

export default withWorkflow(nextConfig);
