import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/i/teamlogos/ncaa/500/**",
      },
      {
        protocol: "https",
        hostname: "sports.cbsimg.net",
        pathname: "/fly/images/team-logos/**",
      },
    ],
    // The live bracket's logos are SVGs; the sandbox keeps any script in them
    // from running.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
