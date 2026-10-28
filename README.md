# DIVIDUAL — Render-only, three-page installation

This version uses **one Node.js Web Service on Render** for all communications. **No Firebase, no other backend and no npm dependencies**. It has only TWO automatic audio cues, played from the separate speaker laptop:

- **SHARE PRIVATELY → `audio/Privately.mp3`** (the poem text NEVER leaves the visitor's device).
- **SHARE ANONYMOUSLY → `audio/Publicly.mp3`** (the poem is saved to the public archive).

**The MP3 recordings are NOT bundled.** Add your actual audio files with those exact filenames and extension. File names are case-sensitive on Render.

## Three main pages

| Device | Page | Purpose |
|---|---|---|
| Audience phones | `https://YOUR-SITE.onrender.com/` | Scan QR, fill three fragments, share privately or anonymously |
| Your control computer | `https://YOUR-SITE.onrender.com/master.html` | Counts, public activity, speaker online status, mute/unmute, volume, and private/public test buttons |
| Speaker laptop | `https://YOUR-SITE.onrender.com/audio.html` | **Only this computer plays MP3 files** when triggered |

Extras: `/answers.html` = public archive, `/cards.html` = printable QR cards. `sound.html` redirects to `/audio.html` for old links.

## 1. Add your two MP3s

In the website folder, open `audio/` and add:

```
DIVIDUAL_Render_3_Pages/
  server.js
  package.json
  render.yaml
  index.html
  master.html
  audio.html
  answers.html
  cards.html
  core.js
  config.js
  style.css
  Copy of outline eye.png
  audio/
    Privately.mp3  <-- YOUR recording
    Publicly.mp3   <-- YOUR recording
```

Do **not** rename them `privately.mp3` or `Privately.mp3.mp3`. There is no ambient sound, generated chime, or spoken line. If the correct MP3s are missing, the speaker page displays an error **and plays no substitute sound**.

## 2. Host entirely on Render

If you previously deployed DIVIDUAL as a **Static Site**, make a **new Web Service** for this version instead. A Static Site cannot relay live messages to another laptop by itself.

1. Put **the contents of this folder** in the root of a GitHub repository (not in an extra nested folder). Include your two MP3 files.
2. Go to [Render Dashboard](https://dashboard.render.com/) → **New → Web Service** → select your GitHub repository.
3. Use:
   - **Language/runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Root directory:** leave blank if files are at the repo root
   - **Instance:** Free for rehearsals, **paid recommended for the public show**
4. Add an **Environment Variable**: name `ADMIN_KEY`, value **a unique strong password of your choosing**. You will enter the exact same key on both `master.html` and `audio.html` (on different computers). Never put the value inside GitHub source files.
5. Deploy. Alternatively use Render **New → Blueprint** with `render.yaml`, supply the `ADMIN_KEY` secret when prompted. Use **one** creation method, not both.
6. Open the URL Render gives you. The audience home page is `/`; the other page paths are above.
7. Reprint QR codes from the new Web Service's `/cards.html` page. **Old Static Site QR codes point to the previous deployment**, so check the address carefully.

### Important reliability choice

Render's **Free Web Service can spin down after inactivity and can restart at any time**. A restart clears the default in-memory public poem archive and recent event history. Its free filesystem is ephemeral. For a public performance requiring dependable continuous audio and saved poems, use a **paid Render Web Service** and optionally attach a persistent disk.

**Persistent public poems (paid Render option):**

- Attach a Render persistent disk to the Web Service, mounted at `/var/data`.
- Set a second Render environment variable: `DATA_FILE=/var/data/poems.json`.
- Restart/redeploy. Only **anonymous public** poems are written to this file. The player cues and private poems are never saved to the archive.
- Keep the web service at one instance, since this simple live signal relay is in process memory.

Free Render PostgreSQL is also a Render-hosted service, but this particular minimal project avoids requiring a separate database; use a disk for persistent archive or accept temporary storage for a short session.

## 3. Run the installation

1. **Speaker computer:** Open `/audio.html`, enter `ADMIN_KEY`, click **ENABLE AUDIO** once. Confirm both filenames show **File loaded**. Connect its headphone/audio interface to the venue speakers. Keep this tab open, the laptop awake, and system audio unmuted. This one click is required by browser autoplay restrictions.
2. **Master computer:** Open `/master.html`, enter the same `ADMIN_KEY`. Confirm it says **PLAYER READY**. Use **TEST PRIVATELY** and **TEST PUBLICLY**; listen for the right track on the **speaker computer**, not the master.
3. **Audience phones:** Open `/` or scan the printed QR cards. They complete F2, K7, and D9. At the end, they choose:
   - **SHARE PRIVATELY:** the server receives only a *private trigger*; audio laptop plays `Privately.mp3`, and their poem remains in their own browser storage.
   - **SHARE ANONYMOUSLY:** the server gets three submitted phrases; audio laptop plays `Publicly.mp3`, and the poem appears on `/answers.html`.
4. **Master:** **MUTE SOUNDS** stops automatic future cues; **ENABLE SOUNDS** resumes them. Remote tests still work while muted so you can soundcheck. Set the output **volume** using the slider. The master has no player and makes no sound.

If two visitors share simultaneously, the speaker page **queues the files one after the other** rather than playing the two MP3s over each other.

## Notes

- The two sound recordings must be provided by you; the package intentionally includes only filename instructions in the `audio/` folder.
- **One audio player computer** should be armed, or multiple audio pages will each play the sound.
- The audience UI, poetry fragments, eye graphic, public archive and QR-print utility are retained. To change the placeholder poems/codes, edit `config.js`.
- Only public poems are visible to others. Avoid requesting visitors' names or personal information. Anonymity is not content moderation; the public archive currently has no pre-approval or administrative deletion UI. Use for a monitored installation.
- The server rate-limits submissions to 120 per minute per source IP; with many visitors sharing a Wi-Fi network this limit may need adjusting (`server.js`, `rateLimit`).
- Test with real audience phones on their own network/mobile data and the venue's separate speaker computer **before** your show.

## Local test (optional)

```sh
ADMIN_KEY=my-test-master-key npm start
```

Then open `http://localhost:3000/`, `http://localhost:3000/master.html` and `http://localhost:3000/audio.html` in separate browser windows. Different devices on the same network should use your Render URL, not localhost.
