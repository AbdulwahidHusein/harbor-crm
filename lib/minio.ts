import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireMinioConfig(): { endpoint: string; accessKeyId: string; secretAccessKey: string; bucket: string } {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKeyId = process.env.MINIO_ACCESS_KEY;
  const secretAccessKey = process.env.MINIO_SECRET_KEY;
  const bucket = process.env.MINIO_BUCKET;
  const missing = [
    !endpoint && "MINIO_ENDPOINT",
    !accessKeyId && "MINIO_ACCESS_KEY",
    !secretAccessKey && "MINIO_SECRET_KEY",
    !bucket && "MINIO_BUCKET",
  ].filter((name): name is string => Boolean(name));
  if (missing.length > 0 || !endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(`${missing.join(", ")} is not defined`);
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

/**
 * URL browsers use to reach the bucket. In Docker MINIO_ENDPOINT is an
 * internal hostname (http://minio:9000) that only the app can resolve, so
 * links and presigned URLs must use the public one. MINIO_PUBLIC_ENDPOINT is
 * read at runtime; NEXT_PUBLIC_MINIO_ENDPOINT is kept for older setups.
 */
export function minioPublicEndpoint(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.MINIO_PUBLIC_ENDPOINT ||
    env.NEXT_PUBLIC_MINIO_ENDPOINT ||
    env.MINIO_ENDPOINT ||
    ""
  ).replace(/\/+$/, "");
}

function createClient(endpoint: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    endpoint,
    region: "us-east-1", // MinIO requires a region value; actual value doesn't matter
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // REQUIRED for MinIO — without this, SDK uses virtual-hosted-style which breaks
  });
}

function lazyClient(resolveEndpoint: (config: ReturnType<typeof requireMinioConfig>) => string): S3Client {
  let client: S3Client | undefined;
  return new Proxy({} as S3Client, {
    get(_target, prop, receiver) {
      if (!client) {
        const config = requireMinioConfig();
        client = createClient(resolveEndpoint(config), config.accessKeyId, config.secretAccessKey);
      }
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const MINIO_BUCKET = process.env.MINIO_BUCKET;
export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
export const MINIO_PUBLIC_URL = minioPublicEndpoint();

/** For server-side reads and writes (internal endpoint). */
export const minioClient = lazyClient((config) => config.endpoint);

/**
 * For presigned URLs handed to browsers. A SigV4 signature covers the host,
 * so the URL must be signed for the endpoint the browser will call. Signing
 * makes no network request, so the app never has to reach this endpoint.
 */
export const minioPresignClient = lazyClient((config) => {
  const publicUrl = minioPublicEndpoint();
  return publicUrl && publicUrl !== config.endpoint ? publicUrl : config.endpoint;
});

/** Short-lived GET link for a private object. Hand it out only after an access check. */
export function presignGet(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    minioPresignClient,
    new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }),
    { expiresIn },
  );
}

/**
 * Short-lived PUT link. The Content-Type is part of the signature, so the
 * storage refuses an upload sent with any other type.
 */
export function presignPut(key: string, contentType: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(
    minioPresignClient,
    new PutObjectCommand({ Bucket: MINIO_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn, signableHeaders: new Set(["content-type"]) },
  );
}
