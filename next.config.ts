import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static landing: no partial rendering that would require JavaScript to reveal content.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
