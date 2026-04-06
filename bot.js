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
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`👋 Welcome to SSD, ${member.displayName}!`)
    .setDescription(
      `Hey ${member}! We're happy to have you in **Society of Software Developers @ UF** 🐊\n\n` +
      `Here's what to check out first:`
    )
    .addFields(
      { name: ' Upcoming Events', value: 'Keep an eye on <#' + CONFIG.ANNOUNCEMENTS_CHANNEL_ID + '> for event drops', inline: false },
      { name: ' Stay Connected', value: '• Instagram: [@uf.ssd](https://instagram.com/uf.ssd)\n• LinkedIn: [SSD UF](https://linkedin.com/company/ssduf)\n• Linktree: [linktr.ee/ufssd](https://linktr.ee/ufssd)', inline: false },
      { name: ' Say Hi', value: `Introduce yourself in <#${CONFIG.GENERAL_CHANNEL_ID}>!`, inline: false }
    )
    .setThumbnail(member.guild.iconURL())
    .setFooter({ text: 'Society of Software Developers @ UF' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
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

    await channelTarget.send({ embeds: [embed] });
    await interaction.reply({ content: ` Recruitment message sent to ${channelTarget}!`, ephemeral: true });
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
client.once('ready', () => {
  console.log(` SSD Bot is online as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN);
