"use strict";

import fs from "fs";
import path from "path";
import { Sequelize, DataTypes, ModelStatic, Options } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
import dbConfig from "../config/database";

const basename = path.basename(__filename);
const env =
  (process.env.NODE_ENV as "development" | "test" | "production") ||
  "development";

// Ensure config is typed properly
const config = dbConfig[env] as Options;

if (!config) {
  throw new Error(`Database config not found for NODE_ENV="${env}"`);
}

// Create Sequelize instance
let sequelize: Sequelize;
if (
  "use_env_variable" in config &&
  typeof config.use_env_variable === "string"
) {
  // <-- UPDATED: added type guard
  const dbUrl = process.env[config.use_env_variable];
  if (!dbUrl) {
    throw new Error(
      `Environment variable "${config.use_env_variable}" is not set`
    );
  }
  sequelize = new Sequelize(dbUrl, config);
} else {
  sequelize = new Sequelize(
    config.database as string,
    config.username as string,
    config.password as string,
    config
  );
}

// Load all models dynamically
interface DB {
  [key: string]: ModelStatic<any> | Sequelize;
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
}

const db = {} as DB;

fs.readdirSync(__dirname)
  .filter((file) => {
    const ext = path.extname(file);
    return (
      file !== basename &&
      (ext === ".ts" || ext === ".js") &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.js")
    );
  })
  .forEach((file) => {
    const modelImport = require(path.join(__dirname, file));
    const model = modelImport.default
      ? modelImport.default(sequelize, DataTypes)
      : modelImport(sequelize, DataTypes);
    db[model.name] = model;
  });

// Set up model associations
Object.keys(db).forEach((modelName) => {
  const model = db[modelName];
  if ("associate" in model && typeof model.associate === "function") {
    // <-- UPDATED: safe check for associate
    (model as any).associate(db); // <-- UPDATED: cast to any for TS
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
