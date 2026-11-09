# DIVIDUAL — audience-phone audio

This Push the Boat Out installation runs as a single Node.js web service on Render. Audience phones scan or enter **F2, K7 and D9 in any order**, write one part for each code, and choose how to share only after all three parts are complete.

**Audio plays only on the audience member's own phone. No second audio browser or speaker laptop is needed.**

- **Share Privately:** the phone plays audio/Privately.mp3. The poem text remains in the phone browser; the server receives only a private-share activity event (without any poem text).
- **Share Anonymously:** the phone plays audio/Publicly.mp3 and publishes the three answers to the public archive.
- Each confirmation screen has a **REPLAY SOUND** button. Phone media volume must be turned up.
- The master dashboard shows private/public counts and recent activity, but does not play or control sound.
- The retired /audio.html page is only an informational notice; /sound.html redirects there.

Phone playback starts directly from the share-button tap, before the server request, to satisfy mobile browser playback restrictions. The MP3 endpoint also supports HTTP byte-range requests for iPhone Safari.

## Pages

| Address | Purpose |
| --- | --- |
| / or /index.html | Audience poem creator and phone playback |
| /answers.html | Public poem archive |
| /cards.html | Printable QR cards |
| /master.html | Password-protected activity dashboard (no audio) |
| /audio.html | Retired player notice (no audio) |

## Deploy

The repository already includes **audio/Privately.mp3** and **audio/Publicly.mp3**. Keep the filenames and casing exactly as shown, or replace these files with final recordings.

1. Connect this repo's **main** branch to a Render **Web Service** (not a Static Site).
2. Use Node.js, build command **npm install**, start command **npm start**, and root directory left blank.
3. Set a strong secret **ADMIN_KEY** as a Render environment variable. Use it to sign in at /master.html; never add the key to GitHub.
4. Deploy the new main commit. If Render auto-deploy is enabled, the push should trigger it.
5. Print QR cards from **/cards.html** at your actual Render service address. Old GitHub Pages QR codes may point elsewhere.

## Rehearsal checklist

1. On an iPhone using Safari and an Android using Chrome, enter the three codes in different orders (e.g. D9 → F2 → K7 or K7 → D9 → F2). All three unique codes are required. Invalid codes are rejected and repeating a code does not count as a new part.
2. Share privately. Verify **only that phone** plays Privately.mp3, and the master private counter increases.
3. Share anonymously. Verify **only that phone** plays Publicly.mp3 and the poem appears in /answers.html.
4. Try **REPLAY SOUND**, and have two phones share at the same time. Each should play its own independent audio.
5. Open /audio.html and /master.html to confirm neither acts as a speaker player.

## Storage and reliability

The default public archive is held in server memory; Render restarts can clear it. For persistence on paid Render, attach a disk and set **DATA_FILE** to a writable location such as /var/data/poems.json. Recent activity and private-share counts are per-server-session. The rate limit is 120 share requests per minute per IP address, which may need consideration at a busy event with shared Wi-Fi. The public archive does not currently provide moderation or deletion tools.

To test on a computer locally: set ADMIN_KEY and run **npm start**, then open http://localhost:3000. Real mobile testing requires the HTTPS Render deployment.
