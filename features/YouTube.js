import fetch from "node-fetch";
import { promises as fs } from "fs";



const ytdl = require('ytdl-core'); // optional if you need YouTube info

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(`${config.prefix}watch`) || message.author.bot) return;

  const args = message.content.split(' ').slice(1);
  const url = args[0];
  if (!url) return message.reply('Please provide a YouTube channel URL.');

  // Extract the channel ID from URL
  let channelId;
  if (url.includes('/channel/')) {
    channelId = url.split('/channel/')[1].split('/')[0];
  } else if (url.includes('/c/') || url.includes('/user/')) {
    // Optional: handle custom URLs with ytdl or YouTube API
    return message.reply('Custom URLs are not supported yet.');
  } else {
    return message.reply('Invalid URL.');
  }

  // Read channels.json
  const channels = JSON.parse(fs.readFileSync('./channels.json', 'utf-8'));
    
  if (channels.includes(channelId)) {
    return message.reply('This channel is already being watched.');
  }

  channels.push(channelId);
  await fs.writeFile('./channels.json', JSON.stringify(channels, null, 2));
  message.reply(`Now watching channel: ${channelId}`);
});

const FILE_PATH = "./AnnouncedUploads.json";
const Parser = require('rss-parser');
const parser = new Parser();

async function loadSeenVideos() {
  try {
    const data = await fs.readFile(FILE_PATH, "utf-8");
    console.log("AnnouncedUploads.json loaded");
    return new Set(JSON.parse(data));
  } catch {
    console.log("No AnnouncedUploads.json found, starting fresh");
    return new Set();
  }
}

async function saveSeenVideos(seen) {
  await fs.writeFile(FILE_PATH, JSON.stringify([...seen], null, 2));
  console.log("AnnouncedUploads.json up-to-date")
}

export default async function youtubeChecker(client, config) {
  let seenVideos = await loadSeenVideos();

  async function checkYouTube() {
    console.log("[YouTube] Checking feed...");

    try {
      const channelIds = JSON.parse(await fs.readFile('./channels.json', 'utf-8'));

      for (const channelId of channelIds) {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      const xml = await res.text();

      const ids = [...xml.matchAll(/<yt:videoId>(.*?)<\/yt:videoId>/g)].map(m => m[1]);
      const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);     
      const links = [...xml.matchAll(/<link rel="alternate" href="([^"]+)"/g)].map(m => m[1]);

      console.log(`[YouTube] Found ${ids.length} videos in feed`);

      const channel = await client.channels.fetch(config.channels.announcements);
      const Logs = await client.channels.fetch(config.channels.logs);

      let newVideos = 0;
      for (let i = ids.length - 1; i >= 0; i--) {
        const videoId = ids[i];
        const title = titles[i + 1]; // titles[0] = channel name
        const link = links[i + 1]; // links[0] = channel link

        // If a video is not in the "seen videos"
        if (!seenVideos.has(videoId)) {

          // Add that video to the list of seen videos
          seenVideos.add(videoId);

          // The Announce it
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          if (link.includes("/shorts/")) {
            if (channel?.isTextBased()) {
            await channel.send(`Check out this short: ${videoUrl}`);
            console.log(`[YouTube] Announced short: ${title}`);
            if (Logs?.isTextBased()) {
              await Logs.send(`[YouTube] Announced short: ${title}`);
            }
          }
        } else {
          if (channel?.isTextBased()) {
            await channel.send(`Check out this video: ${videoUrl}`);
            console.log(`[YouTube] Announced video: ${title}`);
            if (Logs?.isTextBased()) {
              await Logs.send(`[YouTube] Announced video: ${title}`);
            }
          }
        }
          newVideos++;
        }
      }
    }

      if (newVideos > 0) {
        await saveSeenVideos(seenVideos);
        console.log(`[YouTube] Updated AnnouncedUploads.json with ${newVideos} new video(s).`)
      } else {
        console.log("[YouTube] No new videos to announce.")
      }
    } catch (err) {
      console.error("[YouTube] Failed to check feed:", err);
    }
  }

  client.once("ready", () => {
    setInterval(checkYouTube, config.youtube.intervalMinutes * 60 * 1000);
    checkYouTube();
  });
}