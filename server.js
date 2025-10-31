const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔑 tue credenziali
const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// questo è quello che hai messo su Spotify Developer
const REDIRECT_URI = "https://spotify-proxy-it65.onrender.com/callback";

// CORS (comodo)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 1) home
app.get("/", (req, res) => {
  res.send(`
    <h1>Spotify Cloner (Render)</h1>
    <p><a href="/login-source">1️⃣ Login account SORGENTE (leggi playlist)</a></p>
    <p><a href="/login-target">2️⃣ Login account DESTINAZIONE (crea playlist)</a></p>
    <p><a href="/login">🧪 Login completo (test)</a></p>
  `);
});

// 2) login “generico” (tutto)
app.get("/login", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope:
      "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-read-email",
    state: "generic",
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 3) login solo lettura (sorgente)
app.get("/login-source", (req, res) => {
  const scope =
    "playlist-read-private playlist-read-collaborative user-library-read";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "source",
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 4) login per scrivere (destinazione)
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

// 5) callback (UNICA)
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

    // auth basic
    const basic = Buffer.from(
      `${CLIENT_ID}:${CLIENT_SECRET}`
    ).toString("base64");

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
        .send(
          `<h3>Errore da Spotify</h3><pre>${JSON.stringify(data, null, 2)}</pre>`
        );
    }

    // mostro di che token si tratta
    res.send(`
      <h2>Token ricevuto per: <u>${state || "sconosciuto"}</u> ✅</h2>
      <p>Copia questo token e salvalo come <b>${state ||
        "generic"}</b> nel tuo sito.</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <p><a href="/">⬅️ Torna alla home</a></p>
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
    const resp = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      {
        headers: {
          Authorization: "Bearer " + access_token,
        },
      }
    );
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
    // 1. prendo i dati della playlist sorgente
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

    // 2. prendo l'utente target (per sapere il suo id)
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

    // 3. creo la playlist sul target
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
          description:
            playlistData.description || "Cloned from another account",
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

    // 4. prendo le tracce della playlist sorgente (prima pagina)
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

    // 5. preparo gli URI delle tracce
    const uris = (tracksData.items || [])
      .map((item) => item.track && item.track.uri)
      .filter(Boolean);

    // 6. aggiungo le tracce alla nuova playlist (se ci sono)
    if (uris.length > 0) {
      const addResp = await fetch(
        `https://api.spotify.com/v1/playlists/${newPlaylistId}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + target_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: uris,
          }),
        }
      );
      const addData = await addResp.json();
      if (!addResp.ok) {
        return res
          .status(addResp.status)
          .json({ error: "cant_add_tracks", detail: addData });
      }
    }

    // OK
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