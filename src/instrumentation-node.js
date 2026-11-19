import { config } from "dotenv";
import path from "node:path";

config({
  path: path.join(process.cwd(), ".env.local"),
  override: true,
  quiet: true,
});
