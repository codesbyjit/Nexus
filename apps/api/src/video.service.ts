import { Injectable } from "@nestjs/common";
import { StorageService } from "./storage.service";

export interface Video {
  videoId: string;
  hlsUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
}

@Injectable()
export class VideoService {
  constructor(private readonly storage: StorageService) {}

  async listVideos(): Promise<Video[]> {
    const prefixes = await this.storage.listPrefixes();

    return Promise.all(
      prefixes.map(async (prefix) => {
        const videoId = prefix.replace(/\/$/, "");

        // ---- HLS ----
        const hlsUrl = this.storage.getPublicUrl(`${prefix}master.m3u8`);

        // ---- THUMBNAIL (optional) ----
        const thumbPath = `${prefix}thumbs/320.webp`;
        const thumbnailUrl = (await this.storage.exists(thumbPath))
          ? this.storage.getPublicUrl(thumbPath)
          : null;

        // ---- META (optional) ----
        let title = videoId;
        let description = "";

        try {
          const meta = await this.storage.getJson(`${prefix}meta.json`);
          title = meta.title ?? title;
          description = meta.description ?? "";
        } catch {
          // meta.json not present → safe fallback
        }

        return {
          videoId,
          hlsUrl,
          title,
          description,
          thumbnailUrl,
        };
      })
    );
  }
}
