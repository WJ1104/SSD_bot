# SSD Discord Marketing Bot 

Automates marketing for Society of Software Developers @ UF — announcements, event reminders, welcome messages, and recruitment posts.

---

## Features
-  **Auto-welcome** new members with club links and channel guide
-  **`/announce`** — post a formatted event embed to announcements (pings @everyone)
-  **Auto 24hr reminders** — bot automatically reminds the server the day before any event you schedule
-  **`/remind`** — manually trigger a reminder for any event
-  **`/recruit`** — drop a recruitment embed into any channel (great for cross-posting to other servers)

---

## Setup (Step by Step)

### Step 1 — Create the Bot on Discord
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it "SSD Bot"
3. Go to **Bot** tab → click **Reset Token** → copy the token (save it, you only see it once)
4. Under Bot, scroll down and enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Go to **OAuth2 → General** and copy your **Client ID**

### Step 2 — Invite the Bot to Your Server
1. Go to **OAuth2 → URL Generator**
2. Check `bot` and `applications.commands`
3. Under Bot Permissions check: Send Messages, Embed Links, Mention Everyone, Manage Messages
4. Copy the generated URL → open it → invite the bot to SSD's server

### Step 3 — Get Your Discord IDs
You need Developer Mode on. In Discord: **Settings → Advanced → Developer Mode ✅**

Then right-click to copy:
- Your **server** → Copy Server ID = `GUILD_ID`
- `#announcements` channel → Copy Channel ID = `ANNOUNCEMENTS_CHANNEL_ID`
- `#general` channel → Copy Channel ID = `GENERAL_CHANNEL_ID`
- `#welcome` channel → Copy Channel ID = `WELCOME_CHANNEL_ID`
- Your admin role (Server Settings → Roles) → Copy Role ID = `ADMIN_ROLE_ID`

### Step 4 — Configure the Bot
```bash
# Clone or download the bot folder, then:
cp .env.example .env
# Open .env and paste all your IDs and token
```

### Step 5 — Install & Run
Make sure you have [Node.js](https://nodejs.org) installed (v18+), then:

```bash
npm install              # install dependencies
node register-commands.js  # register slash commands (run once)
node bot.js              # start the bot
```

You should see: `✅ SSD Bot is online as SSD Bot#XXXX`

---

## Usage

### Post an event announcement
In Discord, type:
```
/announce title:GBM April description:Monthly GBM — come network and hear club updates! date:2025-04-15 time:18:00 location:CSE E222
```
This posts a formatted embed to #announcements and schedules an automatic 24hr reminder.

### Manually send a reminder
```
/remind title:GBM April
```

### Post a recruitment message to another channel
```
/recruit channel:#general message:Come join SSD, we build cool stuff 🐊
```
Or leave `message` blank to use the default pitch.

---

## Keeping the Bot Running 24/7
For the bot to run continuously (not just when your laptop is open), host it for free on [Railway](https://railway.app) or [Render](https://render.com):* currently using render*
1. Push the folder to a GitHub repo (make sure `.env` is in `.gitignore`!)
2. Connect the repo to Railway/Render
3. Add your environment variables in their dashboard
4. Deploy — done!
