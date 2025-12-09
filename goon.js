import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import fs from "fs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const GOON_FILE = "./goon.json";

// Load JSON
function loadGoons() {
    if (!fs.existsSync(GOON_FILE)) return {};
    return JSON.parse(fs.readFileSync(GOON_FILE));
}

function saveGoons(data) {
    fs.writeFileSync(GOON_FILE, JSON.stringify(data, null, 2));
}

const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 600 });

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // !goon
    if (message.content === "!goon") {
        const userID = message.author.id;
        const username = message.author.username;
        await console.log(`[Goon] ${username} has initiated Goon`)
        const goons = loadGoons();

        if (!goons[userID]) {
            goons[userID] = { username, count: 0 };
        }

        goons[userID].count++;
        saveGoons(goons);

        await console.log(
            `${username} has gooned ${goons[userID].count} times!`
        );
    }

    // !goonstats
    if (message.content === "!goonstats") {
        const goons = loadGoons();
        const entries = Object.entries(goons);

        if (entries.length === 0) {
            return message.channel.send("No goon data yet.");
        }

        const top3 = entries
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3);

        const labels = top3.map(([_, obj]) => obj.username);
        const counts = top3.map(([_, obj]) => obj.count);

        const config = {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Goon Count",
                    data: counts,
                    backgroundColor: ["#ff6384", "#36a2eb", "#ffce56"]
                }]
            },
            options: {
                plugins: {
                    title: { display: true, text: "Top 3 Gooners" }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        };

        const image = await chartCanvas.renderToBuffer(config);
        const attachment = new AttachmentBuilder(image, { name: "goonstats.png" });

        message.channel.send({ files: [attachment] });
    }
});