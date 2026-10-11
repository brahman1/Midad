import "dotenv/config";

export function demoConfig(env = process.env) {
  const connection =
    env.DATABASE_URL ??
    "postgres://midad:midad_local_only@127.0.0.1:5438/midad";
  const cloud = env.MIDAD_DEMO_ENABLED === "true";
  if (cloud) {
    if (
      env.RENDER !== "true" ||
      !env.DATABASE_URL ||
      !env.MIDAD_DEMO_PASSWORD ||
      env.MIDAD_DEMO_PASSWORD.length < 20 ||
      env.MIDAD_DEMO_PASSWORD === "Midad-Local-2026!"
    )
      throw new Error(
        "La démonstration hébergée exige Render, une base dédiée et un mot de passe de test distinct (20 caractères minimum).",
      );
  } else if (
    env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(new URL(connection).hostname)
  ) {
    throw new Error(
      "Démonstration locale uniquement ; activation explicite requise pour Render.",
    );
  }
  return {
    connection,
    cloud,
    password: cloud ? env.MIDAD_DEMO_PASSWORD : "Midad-Local-2026!",
  };
}
