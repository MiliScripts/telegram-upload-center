# Telegram File Upload Center

This project is a **serverless file upload center** built on **Cloudflare Workers** that leverages **Telegram's Bot API** for free file storage and sharing. It allows users to upload files, which are then sent to a Telegram chat via a bot, and provides a user-friendly interface to manage and download the uploaded files. This guide will walk you through setting up the project **directly using the Cloudflare Workers dashboard** (no Wrangler CLI required).

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create a Cloudflare Workers Account](#step-1-create-a-cloudflare-workers-account)
3. [Step 2: Create a Telegram Bot](#step-2-create-a-telegram-bot)
4. [Step 3: Get Your Telegram Chat ID](#step-3-get-your-telegram-chat-id)
5. [Step 4: Create a Cloudflare Worker](#step-4-create-a-cloudflare-worker)
6. [Step 5: Bind a KV Namespace](#step-5-bind-a-kv-namespace)
7. [Step 7: Deploy and Test](#step-7-deploy-and-test)

---

## Prerequisites
- A **Cloudflare account**.
- A **Telegram account**.
- Basic knowledge of using web interfaces.

---

## Step 1: Create a Cloudflare Workers Account
1. Go to the [Cloudflare Workers](https://workers.cloudflare.com/) website.
2. Click on **Sign Up** and create a new account or log in if you already have one.
3. Once logged in, navigate to the **Workers** section from the dashboard.

---

## Step 2: Create a Telegram Bot
1. Open Telegram and search for the **BotFather** (Telegram's official bot for creating bots).
2. Start a chat with BotFather and use the `/newbot` command.
3. Follow the instructions:
   - Choose a name for your bot (e.g., `MyUploadBot`).
   - Choose a username for your bot (must end with `bot`, e.g., `MyUploadBot_bot`).
4. Once the bot is created, BotFather will provide you with a **bot token**. Save this token securely.

---

## Step 3: Get Your Telegram Chat ID
1. Start a chat with your newly created bot on Telegram.
2. Send any message to the bot (e.g., `/start`).
3. Open the following URL in your browser (replace `YOUR_BOT_TOKEN` with your actual bot token):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for the `chat` object in the JSON response. The `id` field is your **Chat ID**. Save this ID.

---

## Step 4: Create a Cloudflare Worker
1. In the Cloudflare Workers dashboard, click **Create a Service**.
2. Name your worker (e.g., `telegram-upload-center`).
3. Choose the **HTTP handler** template.
4. Click **Create Service**.

---

## Step 5: Bind a KV Namespace
1. In your worker's dashboard, go to the **KV** section.
2. Click **Create a Namespace** and name it (e.g., `UPLOAD_STORE`).
3. Once created, go back to your worker's **Settings** > **Variables**.
4. Under **KV Namespace Bindings**, click **Edit Variables**.
5. Add a new binding:
   - Variable name: `UPLOAD_STORE`
   - KV namespace: Select the namespace you just created.

---


## Step 6: Deploy and Test
1. Replace the default code in your worker with the provided code.
2. Click **Save and Deploy**.
3. Visit your worker's URL (provided in the dashboard) to access the upload center.
4. Test the functionality:
   - Upload a file.
   - View the list of uploaded files.
   - Download or delete files.

---

## Screenshots
- **Upload Page**: Drag-and-drop file upload interface.
- **File List Page**: View and manage uploaded files.
- **QR Code Modal**: Share files via QR codes.

---

## Support
For questions or support, open an issue on GitHub or reach out to the maintainers.

---

**Star the repo if you find it useful! ⭐**  

---

