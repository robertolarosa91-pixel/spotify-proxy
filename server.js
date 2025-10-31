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

// 1) test
app.get("/", (req, res) => {
  res.send(`
    <h1>Spotify Cloner (Render)</h1>
    <p><a href="/login">🔓 Fai login con Spotify</a></p>
  `);
});

// 2) /login → manda a Spotify
app.get("/login", (req, res) => {
  const state = "from-render";
  const scope =
    "playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-read-email";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state,
  });

  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// 3) /callback → Spotify torna qui
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.status(400).send("Manca il code da Spotify");
  }

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", REDIRECT_URI);

    // auth basic
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
      return res.status(resp.status).send(
        `<h3>Errore da Spotify</h3><pre>${JSON.stringify(data, null, 2)}</pre>`
      );
    }

    // se vuoi vederlo
    res.send(`
      <h2>Token ricevuto ✅</h2>
      <p>State: ${state}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <p><a href="/">Torna alla home</a></p>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>${err.message}</pre>`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server Spotify su porta " + PORT);
});


// ... sopra rimane uguale

// login solo lettura (sorgente)
app.get("/login-source", (req, res) => {
  const scope = "playlist-read-private playlist-read-collaborative user-library-read";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "source"
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// login per scrivere (destinazione)
app.get("/login-target", (req, res) => {
  const scope = "playlist-modify-public playlist-modify-private";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    state: "target"
  });
  res.redirect("https://accounts.spotify.com/authorize?" + params.toString());
});

// nella tua /callback, quando ricevi il token:
app.get("/callback", async (req, res) => {
  // ... tuo codice di prima
  // alla fine:
  // capisco se è source o target
  const state = req.query.state || "";
  // data = token
  res.send(`
    <h2>Token ricevuto per: ${state || "sconosciuto"} ✅</h2>
    <p>Copia questo token e salvalo (${state})</p>
    <pre>${JSON.stringify(data, null, 2)}</pre>
    <p><a href="/">Torna alla home</a></p>
  `);
});