const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember],
});

// Render (Web Service) expects a port bind; harmless elsewhere.
// Also helps keep the service "awake" on free tiers.
const http = require('http');
const PORT = Number(process.env.PORT || 3000);
const server = http.createServer((req, res) => res.end('bot is alive'));
server.listen(PORT, () => console.log(`keep-alive server running on :${PORT}`));

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const WELCOME_INTROS = [
  "Yo — welcome to **SSD**!",
  "Ayy welcome to **SSD**!",
  "Welcome in!",
  "Glad you're here — welcome to **SSD**!",
  "Welcome to **Society of Software Developers**!",
];

const WELCOME_LINES = [
  "We post events, workshops, and opportunities in announcements — tap in.",
  "Workshops, projects, speakers, and people who actually build. You’re in the right spot.",
  "Glad you joined — SSD’s a good place to meet devs and ship stuff.",
  "Welcome to the club — keep an eye on announcements for the next event.",
  "If you’re trying to get better at building, you’re in the right server.",
];

const WELCOME_CHANNEL_LINES = [
  "welcome in",
  "welcome welcome",
  "glad you're here",
  "ayyy welcome",
  "welcome to SSD",
];

// GIFs for a non-repetitive "hi" vibe. You can swap these any time.
// Tip: if a link ever dies, just remove/replace it.
const WELCOME_GIF_URLS = [
  'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif',
  'https://media.giphy.com/media/3ogwFGEHrVxusDbDjO/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
  'https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif',
];


const CONFIG = {
  ANNOUNCEMENTS_CHANNEL_ID: process.env.ANNOUNCEMENTS_CHANNEL_ID || 'YOUR_ANNOUNCEMENTS_CHANNEL_ID',
  GENERAL_CHANNEL_ID:        process.env.GENERAL_CHANNEL_ID       || 'YOUR_GENERAL_CHANNEL_ID',
  WELCOME_CHANNEL_ID:        process.env.WELCOME_CHANNEL_ID       || 'YOUR_WELCOME_CHANNEL_ID',
  ADMIN_ROLE_ID:             process.env.ADMIN_ROLE_ID            || 'YOUR_ADMIN_ROLE_ID',
};

// ─── SCHEDULED EVENTS ─────────────────────────────────────────────────────────
// Format: { title, description, date (YYYY-MM-DD), time (HH:MM 24hr), location }
// The bot will auto-remind 24 hours before each event.
let scheduledEvents = [
  // Example — edit or add your real events:
  // {
  //   title: 'General Body Meeting',
  //   description: 'Monthly GBM — come meet the team, hear about upcoming projects, and network!',
  //   date: '2025-04-15',
  //   time: '18:00',
  //   location: 'CSE E222',
  // },
];

// ─── WELCOME NEW MEMBERS ──────────────────────────────────────────────────────
// Dedupe welcome DMs in case Discord sends duplicate join events during reconnects.
const recentlyWelcomed = new Map(); // key: `${guildId}:${userId}` -> timestamp (ms)

client.on('guildMemberAdd', async (member) => {
  if (member.user?.bot) return;

  const key = `${member.guild.id}:${member.user.id}`;
  const now = Date.now();
  const last = recentlyWelcomed.get(key);
  if (last && now - last < 60_000) return; // ignore duplicates within 60s
  recentlyWelcomed.set(key, now);

  try {
    const intro = pickRandom(WELCOME_INTROS);
    const line = pickRandom(WELCOME_LINES);
    const gifUrl = pickRandom(WELCOME_GIF_URLS);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`👋 ${intro}`)
      .setDescription(
        `Hey ${member.displayName} — we're stoked to have you here 🐊\n\n` +
        `${line}`
      )
      .addFields(
        { name: '📅 Upcoming Events', value: 'Keep an eye on the announcements channel for event drops', inline: false },
        { name: '🔗 Stay Connected', value: '• Instagram: [@uf.ssd](https://instagram.com/uf.ssd)\n• LinkedIn: [SSD UF](https://linkedin.com/company/ssduf)\n• Linktree: [linktr.ee/ufssd](https://linktr.ee/ufssd)', inline: false },
      )
      .setImage(gifUrl)
      .setThumbnail(member.guild.iconURL())
      .setFooter({ text: 'Society of Software Developers @ UF' })
      .setTimestamp();

    // DM the member (best UX, avoids a noisy public channel)
    try {
      await member.send({ embeds: [embed] });
    } catch {
      console.log(`[SSD Bot] Could not DM ${member.displayName} — DMs probably off`);
    }

    // Also greet in the welcome channel (short + fun)
    const welcomeChannel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
    if (welcomeChannel?.isTextBased?.()) {
      const publicLine = pickRandom(WELCOME_CHANNEL_LINES);
      try {
        await welcomeChannel.send({
          content: `<@${member.id}> ${publicLine}`,
          embeds: [new EmbedBuilder().setImage(gifUrl)],
          allowedMentions: { users: [member.id] },
        });
      } catch (err) {
        console.log(`[SSD Bot] Could not post welcome in channel for ${member.displayName} — missing perms?`);
      }
    }
  } catch (err) {
    console.log(`[SSD Bot] Welcome flow errored for ${member.displayName}`);
  }
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Only admins can use bot commands
  if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) {
    return interaction.reply({ content: '❌ You need the admin role to use this command.', ephemeral: true });
  }

  // /announce — post an event announcement embed
  if (interaction.commandName === 'announce') {
    const title       = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const date        = interaction.options.getString('date');
    const time        = interaction.options.getString('time');
    const location    = interaction.options.getString('location');

    const channel = interaction.guild.channels.cache.get(CONFIG.ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) return interaction.reply({ content: '❌ Announcements channel not found.', ephemeral: true });

    const embed = buildEventEmbed({ title, description, date, time, location });
    await channel.send({ content: '@everyone', embeds: [embed] });
    await interaction.reply({ content: '✅ Announcement posted!', ephemeral: true });

    // Save event for auto-reminders
    scheduledEvents.push({ title, description, date, time, location });
    console.log(`[SSD Bot] Event scheduled: ${title} on ${date}`);
  }

  // /remind — manually trigger a reminder for an event by title
  if (interaction.commandName === 'remind') {
    const title = interaction.options.getString('title');
    const event = scheduledEvents.find(e => e.title.toLowerCase() === title.toLowerCase());
    if (!event) return interaction.reply({ content: `❌ No event found with title "${title}".`, ephemeral: true });

    const channel = interaction.guild.channels.cache.get(CONFIG.ANNOUNCEMENTS_CHANNEL_ID);
    const embed = buildReminderEmbed(event);
    await channel.send({ content: '@everyone', embeds: [embed] });
    await interaction.reply({ content: '✅ Reminder sent!', ephemeral: true });
  }

  // /recruit — post a recruitment message to a specified channel (for cross-posting)
  if (interaction.commandName === 'recruit') {
    const message = interaction.options.getString('message');
    const channelTarget = interaction.options.getChannel('channel');

    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle(' Join Society of Software Developers @ UF!')
      .setDescription(message || defaultRecruitMessage())
      .addFields(
        { name: 'Links', value: '• [Instagram](https://instagram.com/uf.ssd)\n• [LinkedIn](https://linkedin.com/company/ssduf)\n• [Linktree](https://linktr.ee/ufssd)' }
      )
      .setFooter({ text: 'SSD UF — Building the future, one line at a time 🐊' })
      .setTimestamp();

    try {
      await channelTarget.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ Recruitment message sent to ${channelTarget}!`, ephemeral: true });
    } catch (err) {
      await interaction.reply({
        content: `❌ I don't have permission to post in ${channelTarget}. Give me **Send Messages** and **Embed Links** permissions in that channel.`,
        ephemeral: true
      });
    }
  }
});

// ─── AUTO REMINDER CRON JOB (runs every hour) ─────────────────────────────────
cron.schedule('0 * * * *', async () => {
  const now = new Date();
  for (const event of scheduledEvents) {
    const eventDate = new Date(`${event.date}T${event.time}:00`);
    const hoursUntil = (eventDate - now) / (1000 * 60 * 60);

    // Send reminder if event is ~24 hours away (within a 1hr window)
    if (hoursUntil > 23 && hoursUntil <= 24) {
      const guild = client.guilds.cache.first();
      if (!guild) continue;
      const channel = guild.channels.cache.get(CONFIG.ANNOUNCEMENTS_CHANNEL_ID);
      if (!channel) continue;

      const embed = buildReminderEmbed(event);
      await channel.send({ content: '@everyone', embeds: [embed] });
      console.log(`[SSD Bot] 24hr reminder sent for: ${event.title}`);
    }
  }
});

// ─── EMBED BUILDERS ───────────────────────────────────────────────────────────
function buildEventEmbed({ title, description, date, time, location }) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(` ${title}`)
    .setDescription(description)
    .addFields(
      { name: ' Date', value: formatDate(date), inline: true },
      { name: ' Time', value: formatTime(time), inline: true },
      { name: ' Location', value: location || 'TBD', inline: true },
    )
    .addFields(
      { name: ' Stay Updated', value: '[Instagram](https://instagram.com/uf.ssd) • [LinkedIn](https://linkedin.com/company/ssduf) • [Linktree](https://linktr.ee/ufssd)' }
    )
    .setFooter({ text: 'Society of Software Developers @ UF 🐊' })
    .setTimestamp();
}

function buildReminderEmbed(event) {
  return new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(` REMINDER: ${event.title} is TOMORROW!`)
    .setDescription(event.description)
    .addFields(
      { name: ' Date', value: formatDate(event.date), inline: true },
      { name: ' Time', value: formatTime(event.time), inline: true },
      { name: ' Location', value: event.location || 'TBD', inline: true },
    )
    .setFooter({ text: 'Society of Software Developers @ UF 🐊' })
    .setTimestamp();
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const date = new Date();
  date.setHours(+h, +m);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function defaultRecruitMessage() {
  return `Are you into software, tech, or just wanna build cool stuff? **SSD at UF** is the place to be.\n\nWe host workshops, GBMs, and bring in industry speakers — all to help you grow as a developer and connect with the community. Come through!`;
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once('clientReady', () => {
  console.log(` SSD Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);