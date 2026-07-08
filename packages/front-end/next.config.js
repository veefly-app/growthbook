const path = require("path");

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const cspHeader = `
    frame-ancestors 'none';
`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.join(__dirname, "../.."),
    // Ace workers: load as raw text so we can create Blob URLs. Turbopack doesn't support
    // webpack's asset/resource the same way - raw-loader gives us the worker source,
    // which we convert to blob: URLs that Ace can load.
    rules: {
      "**/ace-builds/**/worker-*.js": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
    turbopackFileSystemCacheForBuild: true,
    // Constrained/CI builds (NEXT_LIMIT_BUILD_WORKERS=true): the "Collecting
    // page data" phase spawns one worker PER CPU, and each worker loads a full
    // copy of the app — that parallelism is what OOMs on small machines.
    // These serialize it to a single worker: slower, but low, steady memory.
    ...(process.env.NEXT_LIMIT_BUILD_WORKERS === "true"
      ? {
          cpus: 1,
          workerThreads: false,
          staticGenerationMaxConcurrency: 1,
          staticGenerationMinPagesPerWorker: 100000,
        }
      : {}),
  },
  sassOptions: {
    silenceDeprecations: [
      "legacy-js-api",
      "import",
      "slash-div",
      "color-functions",
      "global-builtin",
      "abs-percent",
    ],
  },
  headers: () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: cspHeader.replace(/\n/g, ""),
        },
        {
          key: "X-Frame-Options",
          value: "deny",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
      ],
    },
  ],
  transpilePackages: ["echarts", "zrender"],
  webpack: (config) => {
    // Ace workers: use raw-loader (same as Turbopack) so we get source and create
    // Blob URLs. asset/resource only works with webpack, not Turbopack.
    config.module.rules.push({
      test: /ace-builds.*\/worker-.*\.js$/,
      use: "raw-loader",
    });

    // Suppress OpenTelemetry dynamic require warnings from Sentry
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@opentelemetry\/instrumentation/,
        message:
          /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
  // Source-map generation is very memory-heavy during the production build.
  // Keep it on by default, but allow disabling it for constrained/CI builds
  // (set NEXT_DISABLE_SOURCEMAPS=true) to keep peak memory under control.
  productionBrowserSourceMaps: process.env.NEXT_DISABLE_SOURCEMAPS !== "true",
};

module.exports = withBundleAnalyzer(nextConfig);
