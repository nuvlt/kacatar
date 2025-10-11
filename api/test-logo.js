const axios = require("axios");

module.exports = async (req, res) => {
  try {
    const team = req.query.team || req.query.t || "";
    if (!team) return res.status(400).json({ error: "team query param required, e.g. ?team=PSG" });

    const key = process.env.THESPORTSDB_KEY || "3";
    const url = `https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(team)}`;

    console.log("TEST-LOGO: Fetching", url);
    const resp = await axios.get(url, { timeout: 10000 });
    console.log("TEST-LOGO: status", resp.status);
    return res.json({ ok: true, url, data: resp.data });
  } catch (err) {
    console.error("TEST-LOGO error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
