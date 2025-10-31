import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

// questo DEVE essere uguale a quello messo su Spotify Developer
const REDIRECT_URI = "https://spotify-proxy-it65.onrender.com/callback";

app.get("/", (req, res) => {
  res.json({ ok: true, service: "spotify-token-proxy" });
});

// 1) endpoint dove Spotify ti rimanda col code
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    return res.status(400).json({ error: "missing_code" });
  }

  try {
    // scambio code -> token
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", REDIRECT_URI);

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await resp.json();

    // se vuoi vederlo grezzo:
    // return res.json(data);

    // se vuoi rimandarlo ad Altervista con una GET (facoltativo):
    // const url = new URL("https://worldhostingfree.altervista.org/clone.php");
    // url.searchParams.set("access_token", data.access_token || "");
    // url.searchParams.set("refresh_token", data.refresh_token || "");
    // return res.redirect(url.toString());

    // per ora mostriamo tutto
    return res.send(`
      <h1>Token ricevuto da Spotify</h1>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "token_exchange_failed", detail: err.message });
  }
});

// 2) endpoint POST /token (se un domani vuoi continuare a usarlo da Altervista)
app.post("/token", async (req, res) => {
  const { code, redirect_uri } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: "missing_code" });
  }

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "authorization_code");
    body.append("code", code);
    body.append("redirect_uri", redirect_uri || REDIRECT_URI);

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    const data = await resp.json();
    return res.json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "token_exchange_failed", detail: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server listening on " + PORT);
});