const config = {
    default: {
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
      },
    },
    buildCommand: "npm run build:next",
  };
  
  export default config;
  