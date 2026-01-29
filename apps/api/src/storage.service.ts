import { Injectable } from "@nestjs/common";
import { Client } from "minio";
import * as fs from "fs";
import { readdir } from "fs/promises";
import { join, extname } from "path";

interface FileEntry {
  full: string;
  relative: string;
}

function parseEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  return {
    endPoint: url.hostname,
    port: Number(url.port) || 9000,
    useSSL: url.protocol === "https:",
  };
}

@Injectable()
export class StorageService {
  private client: Client;

  constructor() {
    const { endPoint, port, useSSL } = parseEndpoint(
      process.env.S3_ENDPOINT || "http://localhost:9000"
    );

    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey: process.env.S3_ACCESS_KEY!,
      secretKey: process.env.S3_SECRET_KEY!,
    });
  }

  /* ================= UPLOAD FOLDER ================= */
  async uploadFolder(localDir: string, prefix: string) {
    const files = await this.walk(localDir);

    for (const file of files) {
      const objectName = `${prefix}/${file.relative}`;
      const stat = fs.statSync(file.full);

      if (stat.size === 0) continue;

      const ext = extname(file.full).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".m3u8":
          contentType = "application/vnd.apple.mpegurl";
          break;
        case ".ts":
          contentType = "video/MP2T";
          break;
        case ".webp":
          contentType = "image/webp";
          break;
        case ".json":
          contentType = "application/json";
          break;
        case ".mp4":
          contentType = "video/mp4";
          break;
      }

      // Upload text/binary content for small files like .m3u8 or .json
      if (ext === ".m3u8" || ext === ".json") {
        const content = fs.readFileSync(file.full);
        await this.client.putObject(
          this.bucketName(),
          objectName,
          content,
          content.length,
          { "Content-Type": contentType }
        );
      } else {
        // Upload file directly for large media files (.ts, .webp, .mp4)
        await this.client.fPutObject(this.bucketName(), objectName, file.full, { "Content-Type": contentType });
      }
    }
  }

  /* ================= FILE HELPERS ================= */

  async exists(objectPath: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName(), objectPath);
      return true;
    } catch (err: any) {
      if (err.code === "NotFound") return false;
      throw err;
    }
  }

  async getJson(objectPath: string): Promise<any> {
    const stream = await this.client.getObject(this.bucketName(), objectPath);

    return new Promise((resolve, reject) => {
      let data = "";
      stream.on("data", (chunk) => (data += chunk.toString()));
      stream.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      stream.on("error", reject);
    });
  }

  getPublicUrl(path: string) {
    return `${process.env.S3_ENDPOINT}/${this.bucketName()}/${path}`;
  }

  /* ================= LIST PREFIXES ================= */

  async listPrefixes(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const prefixes = new Set<string>();
      const stream = this.client.listObjectsV2(this.bucketName(), "", true);

      stream.on("data", (obj) => {
        if (!obj.name) return;
        const [prefix] = obj.name.split("/");
        prefixes.add(prefix + "/");
      });

      stream.on("end", () => resolve([...prefixes]));
      stream.on("error", reject);
    });
  }

  /* ================= INTERNAL ================= */

  private async walk(dir: string, base = dir): Promise<FileEntry[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: FileEntry[] = [];

    for (const entry of entries) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await this.walk(full, base)));
      } else {
        files.push({
          full,
          relative: full.slice(base.length + 1),
        });
      }
    }

    return files;
  }

  private bucketName() {
    return process.env.S3_BUCKET!;
  }
}
