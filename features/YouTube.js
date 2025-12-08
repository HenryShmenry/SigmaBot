import { promises as fs } from "fs";
import fetch from "node-fetch";

export default async function youtubeBot(client, config) {
    const ANNOUNCED_FILE = "./AnnouncedUploads.json";
    const CHANNELS_FILE = "./channels.json";

    // Load or initialize seen videos
    async function loadSeenVideos() {
        try {
            const data = await fs.readFile(ANNOUNCED_FILE, "utf-8");
            console.log("AnnouncedUploads.json loaded");
            return new Set(JSON.parse(data));
        } catch {
            console.log("No AnnouncedUploads.json found, starting fresh");
            return new Set();
        }
    }

    async function saveSeenVideos(seen) {
        await fs.writeFile(ANNOUNCED_FILE, JSON.stringify([...seen], null, 2));
        console.log("AnnouncedUploads.json up-to-date");
    }

    // Load or initialize channels.json
    async function loadChannels() {
        try {
            const data = await fs.readFile(CHANNELS_FILE, "utf-8");
            return data.trim() ? JSON.parse(data) : [];
        } catch {
            await fs.writeFile(CHANNELS_FILE, JSON.stringify([]));
            return [];
        }
    }

    async function saveChannels(channels) {
        await fs.writeFile(CHANNELS_FILE, JSON.stringify(channels, null, 2));
    }

    // Prompt for a channel if none are configured
    async function promptForChannel() {
        const channels = await loadChannels();
        if (channels.length === 0) {
            const channel = await client.channels.fetch(config.channels.requestChannelId);
            if (channel?.isTextBased()) {
                await channel.send(
                    `No YouTube channels are currently being watched. ` +
                    `Use \`${config.prefix}watch {YOUTUBE_CHANNEL_ID}\` to add one!`
                );
                console.log("[YouTube] Requested a channel to watch.");
            }
        }
    }

    const seenVideos = await loadSeenVideos();

    // Helper: check a single channel and announce videos
    async function checkYouTubeForChannel(channelId) {
        try {
            const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
            const xml = await res.text();

            const ids = [...xml.matchAll(/<yt:videoId>(.*?)<\/yt:videoId>/g)].map(m => m[1]);
            const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
            const links = [...xml.matchAll(/<link rel="alternate" href="([^"]+)"/g)].map(m => m[1]);

            const announcementChannel = await client.channels.fetch(config.channels.announcements);
            const logsChannel = await client.channels.fetch(config.channels.logs);

            const channelName = titles[0]; // RSS feed: titles[0] is channel name
            console.log(`[YouTube] Checking ${channelName}`);

            for (let i = ids.length - 1; i >= 0; i--) {
                const videoId = ids[i];
                const title = titles[i + 1]; // titles[0] = channel name
                const link = links[i + 1];   // links[0] = channel link
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

                if (!seenVideos.has(videoId)) {
                    seenVideos.add(videoId);

                    if (announcementChannel?.isTextBased()) {
                        if (link.includes("/shorts/")) {
                            await announcementChannel.send(`Check out this short: ${videoUrl} by ${channelName}`);
                            if (logsChannel?.isTextBased()) await logsChannel.send(`[YouTube] Announced short: ${title} by ${channelName}`);
                            console.log(`[YouTube] Announced short: ${title} by ${channelName}`);
                        } else {
                            await announcementChannel.send(`Check out this video: ${videoUrl} by ${channelName}`);
                            if (logsChannel?.isTextBased()) await logsChannel.send(`[YouTube] Announced video: ${title} by ${channelName}`);
                            console.log(`[YouTube] Announced video: ${title} by ${channelName}`);
                        }
                    }
                }
            }

            await saveSeenVideos(seenVideos);
        } catch (err) {
            console.error(`[YouTube] Failed to check feed for ${channelId}:`, err);
        }
    }

    // Handle !watch command
    client.on("messageCreate", async (message) => {
        if (!message.content.startsWith(`${config.prefix}watch`) || message.author.bot) return;

        const args = message.content.split(" ").slice(1);
        const channelId = args[0];
        if (!channelId) return message.reply("Please provide a YouTube channel ID.");

        // Optional: validate format of channel ID
        if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
            return message.reply("Invalid YouTube channel ID. A valid ID starts with 'UC' and is 24 characters long.");
        }

        // Load existing channels
        const channels = await loadChannels();
        if (channels.includes(channelId)) {
            return message.reply(`This channel is already being watched.`);
        }

        channels.push(channelId);
        await saveChannels(channels);

        // Immediately fetch RSS feed to get channel name and announce videos
        let channelName = channelId;
        try {
            const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
            const xml = await res.text();
            const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
            if (titles[0]) channelName = titles[0];
        } catch (err) {
            console.error(`[YouTube] Failed to fetch RSS for ${channelId}:`, err);
        }

        message.reply(`Now watching channel: ${channelName}`);

        // Immediately announce existing videos
        await checkYouTubeForChannel(channelId);
    });

    // Main function to check all YouTube channels
    async function checkYouTube() {
        const channels = await loadChannels();
        if (channels.length === 0) return;

        for (const channelId of channels) {
            await checkYouTubeForChannel(channelId);
        }
    }

    // Run on bot ready
    client.once("clientReady", async () => {
        console.log(`Logged in as ${client.user.tag}`);

        // Prompt if channels.json is empty
        await promptForChannel();

        // Start interval checking all channels
        const intervalMs = config.youtube.intervalMinutes * 60 * 1000;
        setInterval(checkYouTube, intervalMs);

        // Initial check
        await checkYouTube();
    });
}
