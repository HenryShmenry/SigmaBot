import { promises as fs } from "fs";

async function promptForChannel(client, config) {
  let channels = [];

  // Try reading channels.json
  try {
    const data = await fs.readFile('./channels.json', 'utf-8');
    channels = data.trim() ? JSON.parse(data) : [];
  } catch {
    channels = [];
    await fs.writeFile('./channels.json', JSON.stringify([]));
  }

  // If no channels, send a message to your designated Discord channel
  if (channels.length === 0) {
    const channel = await client.channels.fetch(config.channels.requestChannelId);
    if (channel?.isTextBased()) {
      await channel.send(
        "No YouTube channels are currently being watched. " +
        `Use \`${config.prefix}watch {youtube channel URL}\` to add one!`
      );
      console.log("[YouTube] Requested a channel to watch.");
    }
  }
}

export default promptForChannel;
