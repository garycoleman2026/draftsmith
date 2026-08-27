import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Evidence images are capped at 5 MB in the route; multipart framing needs
    // a little extra room before the handler can enforce that stricter limit.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;
