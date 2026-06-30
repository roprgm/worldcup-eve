import type { MetadataRoute } from "next";

// Explicitly allow every crawler, including social unfurlers (Twitterbot,
// facebookexternalhit, Slackbot, Discordbot, etc.) so link previews can fetch
// our Open Graph and Twitter card images.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    host: "https://wc26.chat",
  };
}
