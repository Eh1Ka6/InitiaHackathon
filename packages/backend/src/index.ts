import dotenv from "dotenv";
dotenv.config();

// Import app AFTER env is loaded
const { app } = require("./app");
const { config } = require("./config");
const { startListening } = require("./services/eventListener");
const { startDrawLifecycleBot } = require("./services/drawLifecycleBot");

app.listen(config.PORT, () => {
  console.log(`WeezWager backend running on port ${config.PORT}`);
});

// Start background services
startListening().catch((err: unknown) =>
  console.error("Failed to start event listener:", err)
);
startDrawLifecycleBot();
