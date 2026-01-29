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
  constructor(private readonly storage: StorageService) { }

  async listVideos(): Promise<Video[]> {
    const prefixes = await this.storage.listPrefixes();

    const videos = await Promise.all(
      prefixes.map(async (prefix) => {
        try {
          const videoId = prefix.replace(/\/$/, "");

          const hlsUrl = this.storage.getPublicUrl(
            `${prefix}master.m3u8`
          );

          const thumbPath = `${prefix}thumbs/320.webp`;
          let thumbnailUrl: string | null = null;

          try {
            if (await this.storage.exists(thumbPath)) {
              thumbnailUrl = this.storage.getPublicUrl(thumbPath);
            }
          } catch { }

          let title = videoId;
          let description = "";

          try {
            const meta = await this.storage.getJson(`${prefix}${videoId}_meta.json`);
            title = meta.title ?? title;
            description = meta.description ?? "";
          } catch (err) {
            console.error("Failed to load meta.json for", prefix, err);
          }


          return {
            videoId,
            hlsUrl,
            title,
            description,
            thumbnailUrl,
          };
        } catch (err) {
          console.error("Video load failed:", prefix, err);
          return null;
        }
      })
    );

    return videos.filter(Boolean) as Video[];
  }

}
