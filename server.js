// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const CLIENT_ID = "1aded29c62d8436fa99caa3da89a1a4b";
const CLIENT_SECRET = "f3ffc2141ed343dfa2ff2297a8807c38";

app.get("/", (req, res) => {
  res.json({ ok: true, service: "spotify-token-proxy" });
});

app.post("/token", async (req, res) => {
  const { code, redirect_uri } = req.body;

  if (!code || !redirect_uri) {
    return res.status(400).json({ error: "missing code or redirect_uri" });
  }

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirect_uri);
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  try {
    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "proxy error", detail: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Proxy Spotify in ascolto su porta " + PORT);
});