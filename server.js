require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

// Zalo Mini App chạy trên domain Zalo — server phải trả một origin duy nhất (không gộp nhiều origin trong một header).
// Tài liệu: https://miniapp.zaloplatforms.com/documents/intro/frequently-solved-issues/
const ALLOWED_ORIGINS = new Set([
  "https://h5.zdn.vn",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
if (process.env.CORS_ORIGINS) {
  for (const o of process.env.CORS_ORIGINS.split(",").map((s) => s.trim())) {
    if (o) ALLOWED_ORIGINS.add(o);
  }
}

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (ALLOWED_ORIGINS.has(origin)) {
      return callback(null, origin);
    }
    return callback(null, false);
  },
});

app.use(corsMiddleware);
app.use(express.json());

// POST /api/get-phone
// Body: { token: string }  — token lấy từ getPhoneNumber() của ZMP SDK
app.post("/api/get-phone", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Thiếu token" });
  }

  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;

  if (!appId || !appSecret) {
    return res
      .status(500)
      .json({ error: "Server chưa cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET" });
  }

  try {
    // Zalo Open API: đổi code (token từ getPhoneNumber) lấy số điện thoại
    // Docs: https://developers.zalo.me/docs/mini-app/api-zalo/get-phone-number
    const response = await axios.get("https://graph.zalo.me/v2.0/me/info", {
      headers: {
        access_token: token,
        secret_key: appSecret,
        "Content-Type": "application/json",
      },
      params: {
        fields: "id,name,picture,phone",
      },
    });

    const data = response.data;

    if (data.error) {
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
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
