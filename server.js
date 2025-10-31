const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔑 tue credenziali Spotify
const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// deve essere IDENTICO a quello messo su Spotify Developer
const REDIRECT_URI = "https://spotify-proxy-it65.onrender.com/callback";

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 1) HOME con interfaccia mobile
app.get("/", (req, res) => {
  res.send(`
<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Spotify Cloner · Proxy</title>
  <style>
    :root {
      --bg: #0f172a;
      --bg2: #111827;
      --panel: rgba(15, 23, 42, 0.6);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #22c55e;
      --accent2: #6366f1;
      --danger: #f43f5e;
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #1f2937 0%, #020617 55%, #000 100%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      justify-content: center;
    }
    .app {
      width: min(460px, 100%);
      padding: 16px 16px 90px;
    }
    header {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .logo {
      width: 42px;
      height: 42px;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.4);
      border-radius: 14px;
      display: grid;
      place-items: center;
      font-size: 20px;
    }
    h1 {
      font-size: 1.27rem;
      line-height: 1.05;
      margin: 0 0 4px;
    }
    .sub {
      font-size: .73rem;
      color: var(--muted);
    }
    .card {
      background: rgba(15, 23, 42, 0.35);
      border: 1px solid rgba(148, 163, 184, .08);
      border-radius: var(--radius);
      padding: 14px 14px 12px;
      margin-bottom: 14px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .card-title {
      font-size: .76rem;
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge {
      font-size: .6rem;
      background: rgba(99, 102, 241, .15);
      border: 1px solid rgba(99, 102, 241, .35);
      border-radius: 999px;
      padding: 2px 8px 3px;
    }
    .btn {
      width: 100%;
      border: 0;
      outline: 0;
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.4);
      border-radius: 14px;
      color: #ecfdf3;
      padding: 11px 12px 10px;
      font-size: .81rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      margin-bottom: 9px;
    }
    .btn small {
      display: block;
      color: rgba(236, 253, 243, .55);
      font-size: .62rem;
    }
    .btn span:first-child {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .ico-circle {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 1rem;
      background: rgba(15, 23, 42, 0.4);
    }
    .btn-secondary {
      background: rgba(99, 102, 241, .12);
      border: 1px solid rgba(99, 102, 241, .35);
    }
    .btn-danger {
      background: rgba(244, 63, 94, .12);
      border: 1px solid rgba(244, 63, 94, .35);
    }
    .footer {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      width: min(420px, 100% - 24px);
      font-size: .62rem;
      color: rgba(148, 163, 184, .5);
      text-align: center;
    }
    pre {
      width: 100%;
      overflow: auto;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 12px;
      padding: 10px;
      font-size: .61rem;
      line-height: 1.3;
    }
    a {
      color: #a855f7;
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="logo">🎧</div>
      <div>
        <h1>Spotify Cloner</h1>
        <p class="sub">Ottieni i 2 token → poi usa il tuo sito (Altervista)</p>
      </div>
    </header>

    <div class="card">
      <div class="card-title">
        🔐 Autenticazione
        <span class="badge">Passo 1</span>
      </div>
      <button class="btn" onclick="location.href='/login-source'">
        <span>
          <span class="ico-circle">1</span>
          <span>
            Sorgente (leggi)
            <small>Account da cui COPIARE le playlist</small>
          </span>
        </span>
        ➜
      </button>
      <button class="btn btn-secondary" onclick="location.href='/login-target'">
        <span>
          <span class="ico-circle">2</span>
          <span>
            Destinazione (scrivi)
            <small>Account su cui CREARE le playlist</small>
          </span>
        </span>
        ➜
      </button>
      <button class="btn" style="margin-bottom:4px" onclick="location.href='/login'">
        <span>
          <span class="ico-circle">🧪</span>
          <span>
            Test completo
            <small>Scope lettura + scrittura</small>
          </span>
        </span>
        ➜
      </button>
    </div>

    <div class="card">
      <div class="card-title">
        🗂️ Come usarli su Altervista
        <span class="badge">Passo 2</span>
      </div>
      <p style="margin:0 0 8px;font-size:.7rem;color:var(--muted)">
        Dopo il login qui sopra, Spotify ti mostra un JSON con <b>access_token</b> e <b>refresh_token</b>.
        Copiali e incollali nei tuoi file PHP (per es. <code>clone.php</code>, <code>login.php</code>) al posto dei token vecchi.
      </p>
      <pre>{
  "access_token": "...",
  "refresh_token": "..."
}</pre>
      <p style="margin:6px 0 0;font-size:.65rem;color:var(--muted)">
        Se tra 1 ora non funziona più, rifai il login da qui e incolla il token nuovo.
      </p>
    </div>

    <div class="card">
      <div class="card-title">
        🧪 Endpoint tecnici
        <span class="badge">Dev</span>
      </div>
      <p style="margin:0 0 6px;font-size:.67rem;color:var(--muted)">
        POST <code>/playlists-source</code> con <code>{"access_token": "..."}</code> → ti restituisce le playlist dell'account sorgente.
      </p>
      <p style="margin:0;font-size:.67rem;color:var(--muted)">
        POST <code>/clone-playlist</code> con <code>{ source_token, target_token, playlist_id }</code> → clona una playlist.
      </p>
    </div>

    <p class="footer">
      Render free · potrebbe “addormentarsi”: se non risponde, apri prima <code>/</code> nel browser.
    </p>
  </div>
</body>
</html>
  `);
});

// 2) login generico
app.get("/login", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-read-email",
    state: "generic",
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 3) login sorgente (lettura)
app.get("/login-source", (req, res) => {
  const scope = "playlist-read-private playlist-read-collaborative user-library-read";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "source",
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 4) login destinazione (scrittura)
app.get("/login-target", (req, res) => {
  const scope = "playlist-modify-public playlist-modify-private";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "target",
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 5) callback unica
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state || "";

  if (!code) {
    return res.status(400).send("Manca il code da Spotify");
  }

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", REDIRECT_URI);

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res
        .status(resp.status)
        .send(`<h3>Errore da Spotify</h3><pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    // risposta "bella"
    res.send(`
<!doctype html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Token ricevuto</title>
  <style>
    body{margin:0;font-family:system-ui;background:#020617;color:#e2e8f0;min-height:100vh;padding:14px}
    .box{background:rgba(15,23,42,.35);border:1px solid rgba(148,163,184,.1);border-radius:14px;padding:14px}
    h2{margin-top:0}
    pre{background:rgba(2,6,23,.35);padding:10px;border-radius:12px;overflow:auto;font-size:.7rem}
    a{color:#38bdf8;text-decoration:none}
  </style>
</head>
<body>
  <div class="box">
    <h2>Token ricevuto per: <u>${state || "sconosciuto"}</u> ✅</h2>
    <p>Copia questo JSON e incollalo nel tuo <b>PHP su Altervista</b> (quello che fa le chiamate a Spotify).</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
    <p><a href="/">⬅️ Torna alla home</a></p>
  </div>
</body>
</html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

// 6) Leggi playlist dal SOURCE
app.post("/playlists-source", async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: "missing_access_token" });
  }

  try {
    const resp = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: { Authorization: "Bearer " + access_token },
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "fetch_error", detail: err.message });
  }
});

// 7) Clona UNA playlist
app.post("/clone-playlist", async (req, res) => {
  const { source_token, target_token, playlist_id } = req.body || {};
  if (!source_token || !target_token || !playlist_id) {
    return res.status(400).json({ error: "missing_params" });
  }

  try {
    // 1. playlist sorgente
    const plResp = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}`, {
      headers: { Authorization: "Bearer " + source_token },
    });
    const playlistData = await plResp.json();
    if (!plResp.ok) {
      return res
        .status(plResp.status)
        .json({ error: "cant_read_source_playlist", detail: playlistData });
    }

    // 2. utente target
    const meResp = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + target_token },
    });
    const meData = await meResp.json();
    if (!meResp.ok) {
      return res
        .status(meResp.status)
        .json({ error: "cant_read_target_user", detail: meData });
    }

    const targetUserId = meData.id;

    // 3. creo playlist sul target
    const createResp = await fetch(
      `https://api.spotify.com/v1/users/${targetUserId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + target_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistData.name + " (cloned)",
          description: playlistData.description || "Cloned from another account",
          public: playlistData.public,
        }),
      }
    );
    const created = await createResp.json();
    if (!createResp.ok) {
      return res
        .status(createResp.status)
        .json({ error: "cant_create_target_playlist", detail: created });
    }

    const newPlaylistId = created.id;

    // 4. tracce
    const tracksResp = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=100`,
      {
        headers: { Authorization: "Bearer " + source_token },
      }
    );
    const tracksData = await tracksResp.json();
    if (!tracksResp.ok) {
      return res
        .status(tracksResp.status)
        .json({ error: "cant_read_tracks", detail: tracksData });
    }

    const uris = (tracksData.items || [])
      .map((item) => item.track && item.track.uri)
      .filter(Boolean);

    // 5. aggiungo tracce
    if (uris.length > 0) {
      const addResp = await fetch(
        `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + target_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris }),
        }
      );
      const addData = await addResp.json();
      if (!addResp.ok) {
        return res
          .status(addResp.status)
          .json({ error: "cant_add_tracks", detail: addData });
      }
    }

    return res.json({
      ok: true,
      source_playlist: playlist_id,
      cloned_to: newPlaylistId,
      cloned_name: playlistData.name,
      tracks_copied: uris.length,
    });
  } catch (err) {
    return res.status(500).json({ error: "clone_error", detail: err.message });
  }
});

// AVVIO
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server Spotify su porta " + PORT);
});