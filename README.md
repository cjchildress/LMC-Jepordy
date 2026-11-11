# Loogootee Methodist Youth Jepordy — GitHub edition

This edition runs on your own GitHub Pages website. Playing does not require ChatGPT. All existing game features remain: two named teams, editable and reusable question files, printing questions and answers, steals, answer review before the next pick, Double Jeopardy, Daily Double wagers, and Final Jeopardy.

## 1. Put the game on GitHub

1. Extract the ZIP to a folder on your computer.
2. Create a GitHub repository, or open the repository you want to use for the game.
3. Upload the extracted files into the repository's top level. You should see `index.html`, `styles.css`, `app.js`, and `firebase-config.js` together. Upload the files, not the ZIP itself.
4. Open the repository's **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, then choose **main** and **/(root)**. Save.
5. Open the website address GitHub shows on that Pages screen. The game works immediately in local play mode.

Both normal account sites and project sites work. All links are relative, including the TV page, so a repository address such as `https://YOUR-USERNAME.github.io/youth-jepordy/` works without editing paths. You do not need to run a build or install software to upload this ZIP.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## 2. Turn on the phone connection

GitHub Pages hosts HTML, CSS, and JavaScript; it does not provide a shared game database. This edition uses your own Firebase Authentication and Cloud Firestore project for that shared connection. There is no dependency on the earlier ChatGPT website. You can complete this setup yourself; connecting Firebase or GitHub to ChatGPT is optional.

### A. Create the Firebase project and web app

1. Open https://console.firebase.google.com/ and create a project for the game. Choose the no-cost **Spark plan**. No payment method is needed for this design. Review the terms offered to you there. This code does not use Cloud Functions, Firebase App Hosting, Cloud Storage, SMS authentication, or other paid-only features. The website itself stays on GitHub Pages.
2. Register a **Web app** using the `</>` icon. Give it a name such as **Youth Jepordy**. Firebase Hosting is not needed because GitHub hosts the website.
3. Firebase shows a `firebaseConfig` object. Keep its public web configuration handy: `apiKey`, `authDomain`, `projectId`, and `appId`.

### B. Create the game host login

1. In Firebase, open **Authentication**, start setup, and enable **Email/Password** as a sign-in provider. Email link sign-in is not needed.
2. Under **Users**, choose **Add user**. Create a dedicated host login with an email and a strong password. You will use this same login on your computer and phone. No sign-up screen is provided in the game.
3. Copy that user's **UID** from the Users list. The UID is not a password.
4. In Authentication settings, add your GitHub Pages hostname to **Authorized domains**, for example `YOUR-USERNAME.github.io` (hostname only, without the repository path).

Never send the host password to ChatGPT or place it in your repository. Firebase signs the host in directly; this app does not save the password in a question file or browser local storage.

### C. Create and protect the database

1. Create a **Cloud Firestore** database in **Standard edition / Native mode**. Use **Production mode**, which starts with access denied. The app uses the default database.
2. Open the supplied `firestore.rules` file in a text editor. Replace `REPLACE_WITH_HOST_USER_UID` with the exact host UID copied above.
3. Copy the entire resulting rules file into your database's **Rules** tab and choose **Publish**. Do not use open/test-mode rules.

The rules permit only the configured host UID to create and control sessions or read the private question set. The TV can get one limited display document using its long random display key; it cannot list sessions, read private rooms, score answers, or consume pairing codes. Unknown data paths are denied.

### D. Connect the website to Firebase

Edit `firebase-config.js` in your GitHub repository:

- Change `enabled: false` to `enabled: true`.
- Set `hostUid` to the same host UID used in the rules.
- Replace the four placeholder values inside `firebase` with your Firebase web configuration.
- Commit/save the file and wait for GitHub Pages to update. Refresh the website on both devices.

The Firebase web configuration identifies your project and is intended for client use. Database access is controlled by the published rules and host authentication. Do not paste a Firebase Admin private key, service-account JSON, GitHub token, or host password into this file.

Official setup: https://firebase.google.com/docs/web/setup
Authentication: https://firebase.google.com/docs/auth/web/password-auth
Security rules: https://firebase.google.com/docs/firestore/security/get-started
Public web API keys: https://firebase.google.com/docs/projects/api-keys

## Free Firebase plan

The design works with the no-cost Spark plan: host email/password authentication and one default Cloud Firestore Standard database. As checked on November 10, 2026, the free Firestore allowance is 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored data, and 10 GiB/month outbound data. The countdown runs locally; only starting, stopping, and other game actions sync. One TV display checks for updates about once a second, so two hours is roughly 7,200 TV reads plus host and rules checks. Typical youth use should fit these limits; this is an estimate, not a usage guarantee.

Stay on Spark without linking a billing account if you want to avoid pay-as-you-go charges. If a free quota is exhausted, the affected service can stop working until its quota resets or the plan changes. The local single-screen game remains available. The Firebase console's Usage tab shows actual usage. Daily Firestore quotas reset around midnight Pacific time. No automatic paid TTL cleanup is used.

Pricing: https://firebase.google.com/pricing
Firestore limits: https://firebase.google.com/docs/firestore/quotas
Plan behavior: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## 3. Play with the phone and TV

1. On the computer connected to your TV, open your GitHub website. Load the questions you want and name the teams.
2. Choose **Connect phone** and sign in with your dedicated game host email and password.
3. Choose **Start TV session & get code**. The computer signs out of the host account and becomes a read-only display. Click **Fullscreen** for the TV.
4. On your phone, open the **same GitHub website**. Choose **Connect phone**, sign in with the same game host login, enter the eight-character code, and choose **Connect as host**.
5. Select questions and judge answers on your phone. You see the current answer privately. The TV shows the question, scores, and the answer when revealed. The answer remains visible until you tap **Next category**.
6. **End live session** disconnects the TV and removes the session's live database documents. The phone keeps a local copy of the game.

Pairing codes work once and expire after ten minutes. Sessions last eight hours. Both devices need internet and can use different networks. Keep one host tab open. Normal updates arrive about a second after the host changes the game. Unsent changes are saved and retried, including across a quick refresh after locking a wager. Revision checks prevent another host tab from silently overwriting the game.

After pairing, the old local question-set cache on the TV computer is cleared; the phone has received the full game. Download custom question sets as portable backups. Closing the browser does not end the session; use **End live session**. Expired sessions stop working automatically, but their documents remain in Firestore until you remove them manually in the Firebase console. Use a dedicated Firebase project so cleanup cannot affect other apps.

## Local play and questions

No Firebase setup is needed for a single-screen game. Open the GitHub website, name the two teams, load or edit the categories, and play.

- **No answer:** review the correct answer, then the other team picks next.
- **Incorrect answer:** the other team gets one steal attempt.
- **Correct answer:** review the correct answer, then award points and let that answering team pick next.
- **Print Q&A:** preview all rounds, then print a paper host copy or save a PDF.
- **Edit questions:** edit categories, questions, answers, references, optional rounds, and Daily Double markers.
- **Download game / Load game:** save and reuse custom JSON question sets.
- **Daily Double:** choose a wager before the question is shown. Only that team answers.
- **Final Jeopardy:** lock both wagers, show the question, reveal the answer, and mark both responses.

The supplied starter set has two 30-question boards and one Final question. Its questions and answers are public source files. For custom sets you want to keep private, load the JSON on the host rather than committing it to a public GitHub repository. Live custom answers are kept in the host-only room and omitted from the TV feed until revealed.

## Troubleshooting

- **Set up phone connection:** Firebase is disabled or its configuration still has placeholders. Single-screen play remains available.
- **Sign-in failed:** check the dedicated host email/password and enable Email/Password in Firebase Authentication.
- **Access denied:** make sure `hostUid` and the UID in the published rules match exactly. Wait for rule updates to propagate. Start a fresh session if the pairing code expired.
- **Blank or unstyled TV page:** upload all supplied files together and refresh. The display uses `display.html` in the same folder as `index.html`.
- **Another host tab changed the game:** local changes are preserved. Close extra host tabs, end the old connection, and start a new one using the game saved on your phone.

The package has been tested with Firebase's local Firestore emulator. Your actual GitHub website and Firebase project must be configured before live phone syncing can be verified there.

## Development checks

The website still runs directly on GitHub Pages. Optional developer checks use Node.js 24 and Java 21 for the local Firestore emulator:

```sh
npm ci
npm test
npm run test:firebase
```

The emulator uses a demo project and a test host UID. It verifies pairing with computers whose clocks are ahead or behind, one-use codes, answer privacy, expiry, and host-only access. TV-session expiry is based on Firebase server time so a fast device clock cannot cause a permission error.


## Read NIV Scripture during answer review

After a correct answer, no answer, or completed steal, choose **Read Scripture** before **Next category**. Read the saved reference in the **New International Version (2011)** on the host screen and connected TV. **Previous verses** and **Next verses** move one verse at a time on both screens. **Back to answer** returns to the answer; **Next category** completes normal scoring and turns. Daily Double answer review is supported too.

NIV text comes directly from the official [Logos RefTagger](https://www.logos.com/reftagger) reader, with its branding and links intact. It requires an internet connection and no additional account or API key. The reader runs in a sandboxed frame with no access to host sign-in or game data. The public-domain bible-api.com index supplies verse numbers only; its verse text is discarded. Firebase synchronizes only the selected reference and page, never a copy of NIV passages. If either provider is unavailable, **Open NIV Bible** opens the full passage in Bible Gateway and leaves the game on answer review.

The bundled Bible Basics questions and printable host sheet use NIV wording, including Finish the Verse and Prayer & Praise. On refresh, exact unchanged questions from older Bible Basics sets update while preserving team names, scores and played questions. Custom wording and imported custom games are preserved. For custom quotations, enter the NIV wording yourself in the question editor.

NIV® Scripture: ©1973, 1978, 1984, 2011 Biblica, Inc. Used by permission. All rights reserved worldwide.
