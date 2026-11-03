const config = {
    default: {
      override: {
        wrapper: "cloudflare-node",
        converter: "edge",
        proxyExternalRequest: "fetch",
      },
    },
    buildCommand: "npm run build:next", // 👈 Add this line here
  };
  
  export default config;
  