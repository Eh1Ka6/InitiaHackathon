import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { config } from "./config";

app.listen(config.PORT, () => {
  console.log(`WeezWager backend running on port ${config.PORT}`);
});
