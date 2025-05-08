// get_token.js (CommonJS version)
const axios = require("axios");
const { writeFileSync } = require("fs");
const dotenv = require("dotenv");

dotenv.config(); // Load environment variables

const url = "https://api.openverse.org/v1/auth_tokens/token/";

const clientId = process.env.OPENVERSE_CLIENT_ID;
const clientSecret = process.env.OPENVERSE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing API credentials. Set OPENVERSE_CLIENT_ID and OPENVERSE_CLIENT_SECRET in your .env file."
  );
  process.exit(1);
}

const data = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: clientSecret,
});

axios
  .post(url, data, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })
  .then((response) => {
    console.log("Access token received:", response.data);
    writeFileSync("access_token.json", JSON.stringify(response.data, null, 2));
    console.log("Access token saved to access_token.json");
  })
  .catch((error) => {
    if (error.response) {
      console.error("Error Response:", error.response.data);
    } else {
      console.error("Request Error:", error.message);
    }
  });
