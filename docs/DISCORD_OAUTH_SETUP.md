# Discord sign-in setup

The Discord application must belong to the site owner, so this part starts in your Discord account.

1. Open <https://discord.com/developers/applications> and choose **New Application**.
2. Name it **Terry's Drafting**.
3. Open **OAuth2** and add this redirect URL exactly:

   `https://draftsmith-teams.companyscreeninginfo.chatgpt.site/api/auth/discord/callback`

4. Copy the **Application ID**. This becomes `DISCORD_CLIENT_ID`.
5. Reset and copy the **Client Secret**. This becomes `DISCORD_CLIENT_SECRET`.
6. In the Terry's Drafting Site settings, add:

   - `DISCORD_CLIENT_ID` — secret
   - `DISCORD_CLIENT_SECRET` — secret
   - `APP_BASE_URL` — `https://draftsmith-teams.companyscreeninginfo.chatgpt.site`

7. Publish the Site again, then test **Sign in** from the dashboard.

Do not paste the client secret into a public issue, chat, commit, or screenshot. If the Site later moves to a custom domain, add that domain's callback URL in Discord and update `APP_BASE_URL` before removing the current callback.
