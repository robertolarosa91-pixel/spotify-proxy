const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// 🔑 credenziali Spotify
const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// deve essere IDENTICO a quello messo su Spotify Dashboard
const REDIRECT_URI = "https://spotify-proxy-it65.onrender.com/callback";

// memoria RAM per i token temporanei
// struttura: { tokenId: { kind: "source"|"target", data: {...}, created: 1730360000000 } }
const TEMP_TOKENS = {};
// dopo quanto tempo buttiamo i token temporanei (30 min)
const TEMP_TTL_MS = 30 * 60 * 1000;

/* --------------------------------------------------
   CORS
-------------------------------------------------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* --------------------------------------------------
   HOME (debug)
-------------------------------------------------- */
app.get("/", (req, res) => {
  res.send(`
    <h1>Spotify Proxy</h1>
    <p>Usalo dal sito Altervista.</p>
    <p><a href="/wake">/wake</a> → per cron-job</p>
  `);
});

/* --------------------------------------------------
   🔁 /wake → per tenere sveglio Render
-------------------------------------------------- */
app.get("/wake", (req, res) => {
  cleanupTemp();
  res.json({ ok: true, ts: Date.now(), tokens_cached: Object.keys(TEMP_TOKENS).length });
});

/* --------------------------------------------------
   1) AVVIO LOGIN SORGENTE
   esempio:
   https://spotify-proxy-it65.onrender.com/auth/source?return=https://worldhostingfree.altervista.org/
-------------------------------------------------- */
app.get("/auth/source", (req, res) => {
  const returnUrl =
    req.query.return || "https://worldhostingfree.altervista.org/";

  const state = JSON.stringify({
    kind: "source",
    returnUrl,
  });

  const scope =
    "playlist-read-private playlist-read-collaborative user-library-read";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
    // 👇 forza Spotify a mostrarti di nuovo la schermata
    show_dialog: "true",
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

/* --------------------------------------------------
   2) AVVIO LOGIN DESTINAZIONE
-------------------------------------------------- */
app.get("/auth/target", (req, res) => {
  const returnUrl =
    req.query.return || "https://worldhostingfree.altervista.org/";

  const state = JSON.stringify({
    kind: "target",
    returnUrl,
  });

  const scope = "playlist-modify-public playlist-modify-private";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
    // 👇 anche qui obblighiamo Spotify a chiedere il consenso
    show_dialog: "true",
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

/* --------------------------------------------------
   3) CALLBACK UNICA
-------------------------------------------------- */
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const stateRaw = req.query.state;

  if (!code) {
    return res.status(400).send("Manca code");
  }

  let parsedState = {};
  try {
    parsedState = JSON.parse(stateRaw);
  } catch (e) {
    // fallback
    parsedState = {
      kind: "unknown",
      returnUrl: "https://worldhostingfree.altervista.org/",
    };
  }

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", REDIRECT_URI);

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      "base64"
    );

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
        .send(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    // genero un id per questo token
    const tokenId = crypto.randomBytes(8).toString("hex");

    TEMP_TOKENS[tokenId] = {
      kind: parsedState.kind, // "source" o "target"
      data,
      created: Date.now(),
    };

    const returnUrl =
      parsedState.returnUrl || "https://worldhostingfree.altervista.org/";
    const url = new URL(returnUrl);
    url.searchParams.set("token_id", tokenId);
    url.searchParams.set("kind", parsedState.kind);

    // rimando su Altervista
    res.redirect(url.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

/* --------------------------------------------------
   4) ALTERVISTA recupera il token
   GET /token/:id
-------------------------------------------------- */
app.get("/token/:id", (req, res) => {
  cleanupTemp();
  const id = req.params.id;
  const entry = TEMP_TOKENS[id];
  if (!entry) {
    return res.status(404).json({ error: "not_found" });
  }

  // se vuoi che sia "usa e butta", decommenta queste 3 righe:
  // const out = entry;
  // delete TEMP_TOKENS[id];
  // return res.json(out);

  // per ora lo lasciamo in RAM
  return res.json(entry);
});

/* --------------------------------------------------
   5) ENDPOINT TECNICI
-------------------------------------------------- */

// 5a) leggi playlist dal sorgente
app.post("/playlists-source", async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token)
    return res.status(400).json({ error: "missing_access_token" });

  try {
    const resp = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      {
        headers: { Authorization: "Bearer " + access_token },
      }
    );
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "fetch_error", detail: err.message });
  }
});

// 5b) clona UNA playlist
app.post("/clone-playlist", async (req, res) => {
  const { source_token, target_token, playlist_id } = req.body || {};
  if (!source_token || !target_token || !playlist_id) {
    return res.status(400).json({ error: "missing_params" });
  }

  try {
    // 1. playlist sorgente
    const plResp = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist_id}`,
      {
        headers: { Authorization: "Bearer " + source_token },
      }
    );
    const playlistData = await plResp.json();
    if (!plResp.ok) {
      return res.status(plResp.status).json({
        error: "cant_read_source_playlist",
        detail: playlistData,
      });
    }

    // 2. utente target
    const meResp = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + target_token },
    });
    const meData = await meResp.json();
    if (!meResp.ok) {
      return res.status(meResp.status).json({
        error: "cant_read_target_user",
        detail: meData,
      });
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
      return res.status(createResp.status).json({
        error: "cant_create_target_playlist",
        detail: created,
      });
    }
    const newPlaylistId = created.id;

    // 4. prendo tracce (prima pagina)
    const tracksResp = await fetch(
      `https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=100`,
      {
        headers: { Authorization: "Bearer " + source_token },
      }
    );
    const tracksData = await tracksResp.json();
    if (!tracksResp.ok) {
      return res.status(tracksResp.status).json({
        error: "cant_read_tracks",
        detail: tracksData,
      });
    }

    const uris = (tracksData.items || [])
      .map((it) => it.track && it.track.uri)
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
        return res.status(addResp.status).json({
          error: "cant_add_tracks",
          detail: addData,
        });
      }
    }

    return res.json({
      ok: true,
      source_playlist: playlist_id,
      cloned_to: newPlaylistId,
      tracks_copied: uris.length,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "clone_error", detail: err.message });
  }
});

/* --------------------------------------------------
   pulizia token vecchi
-------------------------------------------------- */
function cleanupTemp() {
  const now = Date.now();
  for (const [id, entry] of Object.entries(TEMP_TOKENS)) {
    if (now - entry.created > TEMP_TTL_MS) {
      delete TEMP_TOKENS[id];
    }
  }
}

/* --------------------------------------------------
   AVVIO
-------------------------------------------------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Spotify proxy live on " + PORT);
});