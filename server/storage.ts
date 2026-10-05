import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function getObjectStorageConfig() {
  if (!ENV.storageBucket || !ENV.storageRegion || !ENV.storageAccessKeyId || !ENV.storageSecretAccessKey) return null;
  return {
    bucket: ENV.storageBucket,
    client: new S3Client({
      region: ENV.storageRegion,
      endpoint: ENV.storageEndpoint || undefined,
      forcePathStyle: Boolean(ENV.storageEndpoint),
      credentials: { accessKeyId: ENV.storageAccessKeyId, secretAccessKey: ENV.storageSecretAccessKey },
    }),
  };
}

function getForgeConfig() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) return null;
  return { forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""), forgeKey: ENV.forgeApiKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream"): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const objectStorage = getObjectStorageConfig();
  if (objectStorage) {
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await objectStorage.client.send(new PutObjectCommand({ Bucket: objectStorage.bucket, Key: key, Body: body, ContentType: contentType }));
    return { key, url: `/manus-storage/${key}` };
  }

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage config missing. Set S3-compatible storage variables or the legacy storage variables.");
  const presignUrl = new URL("v1/storage/presign/put", `${forge.forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Storage presign failed (${presignResp.status})`);
  const { url: uploadUrl } = (await presignResp.json()) as { url: string };
  if (!uploadUrl) throw new Error("Storage provider returned an empty upload URL");
  const body = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body });
  if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const objectStorage = getObjectStorageConfig();
  if (objectStorage) return getSignedUrl(objectStorage.client, new GetObjectCommand({ Bucket: objectStorage.bucket, Key: key }), { expiresIn: 900 });

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage config missing. Set S3-compatible storage variables or the legacy storage variables.");
  const getUrl = new URL("v1/storage/presign/get", `${forge.forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!resp.ok) throw new Error(`Storage signed URL failed (${resp.status})`);
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Storage provider returned an empty signed URL");
  return url;
}
