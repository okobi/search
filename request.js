import axios from "axios";
import { writeFileSync } from "fs";
require("dotenv").config();
const url = "https://api.openverse.org/v1/auth_tokens/register/";

const data = {
  name: "OpenMedia",
  description: "To access Openverse API",
  email: process.env.EMAIL,
};

axios
  .post(url, data, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
  .then((response) => {
    console.log("Response received:", response.data);

    // Save response to a JSON file
    writeFileSync("response.json", JSON.stringify(response.data, null, 2));
    console.log("Response saved to response.json");
  })
  .catch((error) => {
    if (error.response) {
      console.error("Error Response:", error.response.data);
    } else {
      console.error("Request Error:", error.message);
    }
  });
