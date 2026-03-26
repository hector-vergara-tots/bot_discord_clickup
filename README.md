# Discord Bug Bot

Discord bot that lets your team report bugs and tasks directly from a Discord channel to ClickUp, using Gemini AI to write professional structured reports from informal descriptions.

## How it works

1. A team member runs `/bug` in Discord with a description in plain language
2. The bot selects the appropriate Gemini prompt template based on the task type
3. Gemini produces a structured JSON report with a Markdown-formatted description
4. The bot creates a ClickUp subtask under the specified parent task
5. The bot replies in Discord with a confirmation embed and a direct link to the new task

## Setup

### 1. Prerequisites

- Node.js >= 18
- A Discord application and bot token
- A ClickUp account with API access
- A Google AI (Gemini) API key

### 2. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** → click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it → this is your `DISCORD_TOKEN`
5. Copy the **Application ID** from the **General Information** tab → this is your `DISCORD_CLIENT_ID`
6. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent** if you plan to resolve user mentions by display name
7. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Copy the generated URL and open it to invite the bot to your server

### 3. Get ClickUp credentials

1. Go to https://app.clickup.com/settings/apps → **API Token** → Generate a token → this is your `CLICKUP_API_TOKEN`
2. Your Workspace ID is in the URL when you open ClickUp: `https://app.clickup.com/{WORKSPACE_ID}/...`
3. `CLICKUP_SPACE_ID` is the ID of the Space where task creation is allowed (currently locked to Space `90140175053`)

### 4. Get a Gemini API key

1. Go to https://aistudio.google.com/app/apikey
2. Click **Create API key** → this is your `GEMINI_API_KEY`

### 5. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_id
CLICKUP_API_TOKEN=your_clickup_personal_api_token
CLICKUP_WORKSPACE_ID=your_clickup_workspace_id
CLICKUP_SPACE_ID=90140175053
GEMINI_API_KEY=your_gemini_api_key
```

### 6. Install dependencies and run

```bash
npm install
npm start
```

Slash commands register automatically on startup. Discord may take up to 1 hour to propagate global commands, but usually it's instant.

For development with auto-reload:

```bash
npm run dev
```

## Usage

In any Discord channel where the bot has access, run:

```
/bug task_id:<clickup_task_id> tipo:<bug|improvement|task|test case|test plan> ambiente:<development|staging|production> descripcion:<free text> asignado:<@user (optional)>
```

**Example:**

```
/bug task_id:abc123xyz tipo:bug ambiente:production descripcion:cuando el usuario hace login con Google se queda cargando infinito y nunca entra al dashboard, debería redirigir en menos de 3 segundos asignado:@maria
```

The bot will:
- Verify the parent task belongs to the authorized ClickUp Space
- Resolve `@maria`'s Discord username to their ClickUp account
- Select the Gemini prompt template for the chosen task type
- Ask Gemini to produce a professional structured report (with automatic model fallback)
- Create the subtask with Markdown description, `custom_item_id`, Environment custom field, priority, and tags
- Reply with an embed containing the link to the new task

## Deploying to Railway

1. Push this repo to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub repo
3. Add all environment variables in the Railway dashboard under **Variables**
4. Railway will build and run `node src/index.js` automatically using `railway.json`

Railway runs a persistent process (not serverless), which is required for Discord's WebSocket connection.

## Project structure

```
src/
├── index.js              # Entry point — Discord client, command registration
├── constants.js          # Shared constants (TASK_TYPES custom_item_id map)
├── commands/
│   ├── bug.js            # /bug slash command definition and handler
│   └── testcase.js       # /testcase slash command — generates TCs from a User Story
├── services/
│   ├── gemini.js         # Gemini API — selects template, generates report, model fallback
│   └── clickup.js        # ClickUp REST API — space validation, task creation, retry logic
├── templates/
│   ├── index.js          # Maps custom_item_id → template
│   ├── bug.js            # Prompt + structure for Bug reports
│   ├── improvement.js    # Prompt + structure for Improvements
│   ├── testCase.js       # Prompt + structure for Test Cases and Test Plans
│   └── taskDefault.js    # Prompt + structure for generic Tasks
└── utils/
    ├── logger.js         # Minimal logger with ISO timestamps (no external deps)
    └── parser.js         # Discord→ClickUp user resolution
```

## Notes on user mapping

The bot resolves Discord usernames to ClickUp members by matching against:
- ClickUp username
- ClickUp email (prefix match)
- ClickUp display name

If no match is found, the task is created without an assignee and the bot shows a warning in the confirmation message. To improve matching, make sure your team uses consistent usernames across both platforms.

## Extending the bot

### Add a new slash command

1. Create `src/commands/mycommand.js` following the same pattern as `bug.js`
2. Import and register it in `src/index.js` with `client.commands.set(...)`

Commands register automatically on startup — no extra configuration needed.

### Add a new task type template

1. Create `src/templates/myType.js` exporting `{ systemPrompt, structure }`
2. Import it in `src/templates/index.js` and map it to its `custom_item_id`:

```js
const myType = require('./myType');

module.exports = {
  1004: bug,
  1005: improvement,
  1002: testCase,
  1011: testCase,
  0:    taskDefault,
  9999: myType,  // your new type
};
```

3. Add the new `custom_item_id` to `TASK_TYPES` in `src/constants.js`
4. Add the new choice to the `/bug` slash command in `src/commands/bug.js`
