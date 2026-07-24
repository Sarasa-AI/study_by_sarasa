/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep pino's worker-thread transport out of the Webpack bundle so App Router
    // routes (including NextAuth) do not fail with __webpack_require__ undefined.call.
    serverComponentsExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
