const express = require("express");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// credenziali
const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// il redirect registrato su Spotify
const REDIRECT_URI = "https://spotify-proxy-it65.onrender.com/callback";

// qui dentro teniamo i token temporanei
// struttura: { tokenId: { kind: "source"|"target", data: {...}, created: Date } }
const TEMP_TOKENS = {};

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// homepage debug
app.get("/", (req, res) => {
  res.send(`
    <h1>Spotify Proxy</h1>
    <p>Usalo da Altervista.</p>
  `);
});

/**
 * 1) AVVIO LOGIN SORGENTE
 * chiamata da Altervista:
 *  https://spotify-proxy.../auth/source?return=https://tuosito.altervista.org/
 */
app.get("/auth/source", (req, res) => {
  const returnUrl = req.query.return || "https://worldhostingfree.altervista.org/";
  const state = JSON.stringify({
    kind: "source",
    returnUrl
  });

  const scope = "playlist-read-private playlist-read-collaborative user-library-read";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

/**
 * 2) AVVIO LOGIN DESTINAZIONE
 */
app.get("/auth/target", (req, res) => {
  const returnUrl = req.query.return || "https://worldhostingfree.altervista.org/";
  const state = JSON.stringify({
    kind: "target",
    returnUrl
  });

  const scope = "playlist-modify-public playlist-modify-private";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

/**
 * 3) CALLBACK UNICA
 */
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
    parsedState = { kind: "unknown", returnUrl: "https://worldhostingfree.altervista.org/" };
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
      return res.status(resp.status).send(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
    }

    // genero un id per questo token
    const tokenId = crypto.randomBytes(8).toString("hex");

    TEMP_TOKENS[tokenId] = {
      kind: parsedState.kind,     // "source" o "target"
      data,
      created: Date.now()
    };

    // rimando l'utente su altervista con il tokenId
    const returnUrl = parsedState.returnUrl || "https://worldhostingfree.altervista.org/";
    const url = new URL(returnUrl);
    url.searchParams.set("token_id", tokenId);
    url.searchParams.set("kind", parsedState.kind);

    res.redirect(url.toString());

  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

/**
 * 4) endpoint che ALTERVISTA chiama per prendere il token
 *    GET /token/:id
 */
app.get("/token/:id", (req, res) => {
  const id = req.params.id;
  const entry = TEMP_TOKENS[id];
  if (!entry) {
    return res.status(404).json({ error: "not_found" });
  }

  // opzionale: dopo che lo consegniamo, lo cancelliamo (più sicuro)
  // const out = entry;
  // delete TEMP_TOKENS[id];
  // return res.json(out);

  // per adesso lo lasciamo
  return res.json(entry);
});

/**
 * 5) gli endpoint tecnici che hai già
 */
// leggi playlist
app.post("/playlists-source", async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ error: "missing_access_token" });

  try {
    const resp = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: { Authorization: "Bearer " + access_token }
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: "fetch_error", detail: err.message });
  }
});

// clona playlist (come prima)
app.post("/clone-playlist", async (req, res) => {
  const { source_token, target_token, playlist_id } = req.body || {};
  if (!source_token || !target_token || !playlist_id) {
    return res.status(400).json({ error: "missing_params" });
  }
  try {
    // 1 prendo playlist
    const plResp = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}`, {
      headers: { Authorization: "Bearer " + source_token }
    });
    const playlistData = await plResp.json();
    if (!plResp.ok) {
      return res.status(plResp.status).json({ error: "cant_read_source_playlist", detail: playlistData });
    }
    // 2 prendo utente target
    const meResp = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + target_token }
    });
    const meData = await meResp.json();
    if (!meResp.ok) {
      return res.status(meResp.status).json({ error: "cant_read_target_user", detail: meData });
    }
    const targetUserId = meData.id;
    // 3 creo playlist
    const createResp = await fetch(`https://api.spotify.com/v1/users/${targetUserId}/playlists`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + target_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: playlistData.name + " (cloned)",
        description: playlistData.description || "Cloned",
        public: playlistData.public
      })
    });
    const created = await createResp.json();
    if (!createResp.ok) {
      return res.status(createResp.status).json({ error: "cant_create_target_playlist", detail: created });
    }
    const newPlaylistId = created.id;
    // 4 prendo tracce
    const tracksResp = await fetch(`https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=100`, {
      headers: { Authorization: "Bearer " + source_token }
    });
    const tracksData = await tracksResp.json();
    if (!tracksResp.ok) {
      return res.status(tracksResp.status).json({ error: "cant_read_tracks", detail: tracksData });
    }
    const uris = (tracksData.items || []).map(it => it.track && it.track.uri).filter(Boolean);
    if (uris.length > 0) {
      const addResp = await fetch(`https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + target_token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ uris })
      });
      const addData = await addResp.json();
      if (!addResp.ok) {
        return res.status(addResp.status).json({ error: "cant_add_tracks", detail: addData });
      }
    }
    return res.json({
      ok: true,
      source_playlist: playlist_id,
      cloned_to: newPlaylistId,
      tracks_copied: uris.length
    });
  } catch (err) {
    return res.status(500).json({ error: "clone_error", detail: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Spotify proxy live on " + PORT);
});