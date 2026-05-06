const axios = require("axios");

const ALLOWED_ORIGINS = new Set([
  "https://h5.zdn.vn",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Endpoint này chỉ hỗ trợ POST /api/get-phone với JSON body.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const body = req.body ?? (await readJsonBody(req));

  const userAccessToken =
    body.accessToken ?? body.userAccessToken ?? body.access_token;
  const phoneCode = body.token ?? body.code;

  if (!userAccessToken) {
    return res
      .status(400)
      .json({ error: "Thiếu accessToken (user access token)" });
  }
  if (!phoneCode) {
    return res.status(400).json({ error: "Thiếu token/code từ getPhoneNumber()" });
  }

  const appSecret = process.env.ZALO_APP_SECRET;
  if (!appSecret) {
    return res.status(500).json({ error: "Server chưa cấu hình ZALO_APP_SECRET" });
  }

  try {
    const response = await axios.get("https://graph.zalo.me/v2.0/me/info", {
      headers: {
        access_token: userAccessToken,
        code: phoneCode,
        secret_key: appSecret,
        "Content-Type": "application/json",
      },
      params: {
        fields: "id,name,picture,phone",
      },
    });

    const data = response.data;
    if (data?.error) {
      return res.status(400).json({ error: data.message || "Zalo API lỗi" });
    }

    return res.json({ phone: data.phone, name: data.name });
  } catch (err) {
    const zaloError = err.response?.data;
    console.error("Zalo API error:", zaloError || err.message);
    return res.status(500).json({
      error: zaloError?.message || "Lỗi khi gọi Zalo API",
    });
  }
};

