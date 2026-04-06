const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an event announcement to the announcements channel')
    .addStringOption(opt => opt.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(opt => opt.setName('description').setDescription('Event description').setRequired(true))
    .addStringOption(opt => opt.setName('date').setDescription('Date (YYYY-MM-DD), e.g. 2025-04-15').setRequired(true))
    .addStringOption(opt => opt.setName('time').setDescription('Time (HH:MM 24hr), e.g. 18:00').setRequired(true))
    .addStringOption(opt => opt.setName('location').setDescription('Location, e.g. CSE E222').setRequired(false)),

  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Manually send a reminder for a scheduled event')
    .addStringOption(opt => opt.setName('title').setDescription('Exact event title').setRequired(true)),

  new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('Post a recruitment message to any channel')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post in').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Custom message (optional)').setRequired(false)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  console.log('Registering slash commands...');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ Slash commands registered!');
})();
