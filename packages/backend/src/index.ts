import dotenv from "dotenv";
dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// Import app AFTER env is loaded
const { app } = require("./app");
const { config } = require("./config");

app.listen(config.PORT, () => {
  console.log(`WeezDraw backend running on port ${config.PORT}`);
});

// Start background services — each wrapped so a failure can't kill the server
try {
  const { startListening } = require("./services/eventListener");
  startListening().catch((err: unknown) =>
    console.error("Failed to start event listener:", err)
  );
} catch (err) {
  console.error("Event listener module failed to load:", err);
}

try {
  const { startDrawLifecycleBot } = require("./services/drawLifecycleBot");
  startDrawLifecycleBot();
} catch (err) {
  console.error("Draw lifecycle bot failed to start:", err);
}
