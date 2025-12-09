import { Client, GatewayIntentBits } from "discord.js";
import config from "./config.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`SigmaBot: ${config.edition}`)
  console.log(`Bot is online | Prefix: ${config.prefix}`);
});

// Attempt to load features based on config toggles

if (config.features.youtubeChecker) {
    try {
        import("./features/YouTube.js").then(mod => mod.default(client, config));
        console.log("YouTube Checker Active")
    } catch (err) {
        console.error("Failed to load YouTube Announcements Script:", err);
    }
}

import("./goon.js")
  .then(mod => {
    const fn = mod.default || mod;
    if (typeof fn !== "function") {
      throw new TypeError("goon.js must export a function");
    }
    fn(client, config);
    console.log("Goon Commands Active");
  })
  .catch(err => console.error("Failed to load Goon Commands script:", err));

client.login(config.token);