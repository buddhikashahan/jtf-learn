import type { MetadataRoute } from "next";

/** Only the public marketing & auth pages are crawlable. */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register"],
      disallow: [
        "/dashboard",
        "/courses",
        "/learn",
        "/live",
        "/assignments",
        "/notifications",
        "/settings",
        "/admin",
        "/certificates",
      ],
    },
    ...(site && { host: site }),
  };
}
