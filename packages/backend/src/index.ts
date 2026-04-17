import dotenv from "dotenv";
dotenv.config();

// Import app AFTER env is loaded
const { app } = require("./app");
const { config } = require("./config");

app.listen(config.PORT, () => {
  console.log(`WeezWager backend running on port ${config.PORT}`);
});
