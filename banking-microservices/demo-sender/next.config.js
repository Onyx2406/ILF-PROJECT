/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@apollo/client', 'graphql']
  }
}

module.exports = nextConfig
