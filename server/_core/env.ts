export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  storageBucket: process.env.STORAGE_BUCKET ?? process.env.S3_BUCKET ?? "",
  storageRegion: process.env.STORAGE_REGION ?? process.env.S3_REGION ?? "",
  storageEndpoint: process.env.STORAGE_ENDPOINT ?? process.env.S3_ENDPOINT ?? "",
  storageAccessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID ?? "",
  storageSecretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? "",
};
