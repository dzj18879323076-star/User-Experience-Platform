const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/quest/export-doc": ["./node_modules/@larksuite/cli/**/*"]
  }
};

export default nextConfig;
