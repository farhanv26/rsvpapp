import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
    },
  },
} satisfies OpenNextConfig;
