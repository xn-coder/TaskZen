import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add Supabase storage domain if you plan to use it for avatars, etc.
      // Example:
      // {
      //   protocol: 'https',
      //   hostname: 'your-project-ref.supabase.co', // Replace with your Supabase project ref
      //   port: '',
      //   pathname: '/storage/v1/object/public/**',
      // },
    ],
  },
};

export default nextConfig;
