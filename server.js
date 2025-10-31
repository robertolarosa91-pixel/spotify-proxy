import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Test base per capire se il proxy risponde
app.get("/", (req, res) => {
  res.json({ ok: true, service: "spotify-token-proxy" });
});

// Endpoint per lo scambio del token Spotify
app.post("/token", async (req, res) => {
  const {
    client_id,
    client_secret,
    code,
    redirect_uri,
    grant_type = "authorization_code",
  } = req.body || {};

  if (!client_id || !client_secret || !code || !redirect_uri) {
    return res.status(400).json({ error: "missing_fields" });
  }

  try {
    const params = new URLSearchParams();
    params.append("grant_type", grant_type);
    params.append("code", code);
    params.append("redirect_uri", redirect_uri);
    params.append("client_id", client_id);
    params.append("client_secret", client_secret);

    const resp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
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
