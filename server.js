import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// 🔑 credenziali Spotify
const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// --------------- HOME ---------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Spotify Cloner (Render)</title>
</head>
<body>
  <h1>Spotify Cloner (Render)</h1>

  <p>1️⃣ Fai login con l'account <b>SORGENTE</b></p>
  <button onclick="window.location.href='/login?role=source'">Login sorgente 🔓</button>

  <p>2️⃣ Fai login con l'account <b>DESTINAZIONE</b></p>
  <button onclick="window.location.href='/login?role=target'">Login destinazione 🔓</button>

  <p id="msg"></p>

  <script>
    const s = localStorage.getItem('source_token');
    const t = localStorage.getItem('target_token');
    if (s) document.getElementById('msg').innerText += '✅ Account sorgente collegato\\n';
    if (t) document.getElementById('msg').innerText += '✅ Account destinazione collegato\\n';
  </script>
</body>
</html>
  `);
});

// --------------- LOGIN ---------------
app.get("/login", (req, res) => {
  const role = req.query.role;
  if (role !== "source" && role !== "target") {
    return res.status(400).send("Ruolo non valido");
  }

  const redirectUri = `${req.protocol}://${req.get("host")}/callback`;

  const scope =
    role === "source"
      ? "playlist-read-private playlist-read-collaborative user-library-read"
      : "playlist-modify-public playlist-modify-private user-library-modify";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope,
    redirect_uri: redirectUri,
    state: role,
    show_dialog: "true",
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// --------------- CALLBACK ---------------
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const role = req.query.state;
  const redirectUri = `${req.protocol}://${req.get("host")}/callback`;

  if (!code || !role) {
    return res.status(400).send("Manca code/state");
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("client_id", CLIENT_ID);
    params.append("client_secret", CLIENT_SECRET);

    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res
        .status(resp.status)
        .send("<pre>" + JSON.stringify(data, null, 2) + "</pre>");
    }

    const access_token = data.access_token;

    // (facoltativo) info utente
    const meResp = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + access_token },
    });
    const me = await meResp.json();

    res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Login ${role} ok</title></head>
<body>
  <p>✅ Login ${role} completato per: <strong>${me.display_name || me.id}</strong></p>
  <p>Sto tornando alla home...</p>
  <script>
    localStorage.setItem("${role}_token", "${access_token}");
    window.location.href = "/";
  </script>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send("<pre>" + err.message + "</pre>");
  }
});

// --------------- AVVIO ---------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Spotify cloner running on", PORT));      body: params.toString(),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "spotify_error",
        spotify_response: data,
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "proxy_error", message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Spotify proxy running on", PORT));
