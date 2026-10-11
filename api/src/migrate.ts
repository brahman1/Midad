import { db, migrate } from "./db";
migrate()
  .then(() => {
    console.log("Migrations appliquées");
    return db.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
    return db.end();
  });
