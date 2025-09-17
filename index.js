const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const dotenv = require('dotenv')
dotenv.config()

const apiId = Number(process.env.API_ID)
const apiHash = process.env.API_HASH
const stringSession = new StringSession(process.env.SESSION);

const config = JSON.parse(fs.readFileSync("config.json", "utf8"))
const outputChannel = "@ixlosbekmonitoring";

(async () => {
    console.log(">>> Boshlayapmiz...");
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    await client.connect();
    console.log(">>> User-bot ulandi!");

    const lastMessageIds = {};

    async function checkChannels() {
        for (const channel of config.channels) {
            try {
                const messages = await client.getMessages(channel, { limit: 5 });
                for (const msg of messages) {
                    if (!msg.message) continue;

                    if (lastMessageIds[channel] && msg.id <= lastMessageIds[channel]) {
                        continue;
                    }

                    for (const word of config.keywords) {
                        if (msg.message.toLowerCase().includes(word.toLowerCase())) {
                            console.log(`>>> ${channel} kanalida kalit so'z topildi: ${word}`)
                            const formatted = `📢 *Kalit so‘z topildi!*\n\n` +
                                `🔑 So‘z: *${word}*\n` +
                                `📌 Kanal: ${channel}\n\n` +
                                `📝 Xabar:\n${msg.message}`;

                            await client.sendMessage(outputChannel, {
                                message: formatted,
                                parseMode: "markdown",
                                linkPreview: false
                            });
                        }
                    }

                    if (!lastMessageIds[channel] || msg.id > lastMessageIds[channel]) {
                        lastMessageIds[channel] = msg.id;
                    }
                }
            } catch (err) {
                console.error(`Xatolik: ${channel}`, err.message);
            }
        }
    }

    setInterval(checkChannels, 30 * 1000);
})();

// === Bot komandalar ===
const configJson = require("./config.json");

const { Telegraf, Markup } = require("telegraf");
// === Bot sozlamalari ===
const bot = new Telegraf(process.env.BOT_TOKEN)
const ADMIN_ID = Number(process.env.ADMIN); // faqat admin foydalansin
let currentAction = null;
bot.start((ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply("❌ Siz admin emassiz!");

    ctx.reply(
        "👋 Salom, monitoring boshqaruv bot!\nKerakli tugmani tanlang 👇",
        Markup.keyboard([
            ["➕ Kanal qo‘shish"],
            ["🗑 Kanal o‘chirish"],
            ["📋 Kanal ro‘yxati"]
        ]).resize()
    );
});

// === Kanal qo‘shish ===
bot.hears("➕ Kanal qo‘shish", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("ℹ️ Kanal username kiriting (@ bilan):");
    currentAction = "add";
});

// === Kanal o‘chirish ===
bot.hears("🗑 Kanal o‘chirish", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("❌ O‘chirish uchun kanal username kiriting:");
    currentAction = "remove";
});

// === Kanal ro‘yxati ===
bot.hears("📋 Kanal ro‘yxati", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    if (configJson.channels.length === 0) return ctx.reply("📭 Hali kanal yo‘q.");
    const list = configJson.channels.map((ch, i) => `${i + 1}. ${ch}`).join("\n");
    ctx.reply(`📋 Qo‘shilgan kanallar:\n\n${list}`);
})
bot.on("text", (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    if (!currentAction) return

    const channel = ctx.message.text.trim();

    if (!channel.startsWith("@")) {
        ctx.reply("❌ Username '@' bilan boshlanishi kerak!");
        return;
    }

    if (currentAction === "add") {
        if (configJson.channels.includes(channel)) {
            ctx.reply("⚠️ Bu kanal allaqachon qo‘shilgan.");
        } else {
            configJson.channels.push(channel);
            fs.writeFileSync("config.json", JSON.stringify(configJson, null, 2), "utf8");
            ctx.reply(`✅ Kanal qo‘shildi: ${channel}`);
        }
    }

    if (currentAction === "remove") {
        if (!configJson.channels.includes(channel)) {
            ctx.reply("❌ Bunday kanal mavjud emas.");
        } else {
            configJson.channels = configJson.channels.filter((c) => c !== channel);
            fs.writeFileSync("config.json", JSON.stringify(configJson, null, 2), "utf8");
            ctx.reply(`🗑 O‘chirildi: ${channel}`);
        }
    }

    currentAction = null;
});

bot.launch();
console.log(">>> Boshqaruv bot ulandi!")
