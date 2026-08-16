import { describe, expect, it } from "vitest";
import { isVideo, mediaKindFor } from "@/features/ad-launch/domain/media";

describe("mediaKindFor", () => {
  it("recognises the video formats Meta accepts", () => {
    expect(mediaKindFor("https://cdn.example.com/ad.mp4")).toBe("video");
    expect(mediaKindFor("https://cdn.example.com/ad.MOV")).toBe("video");
    expect(mediaKindFor("https://cdn.example.com/ad.webm")).toBe("video");
  });

  it("recognises images", () => {
    expect(mediaKindFor("https://cdn.example.com/ad.png")).toBe("image");
    expect(mediaKindFor("https://cdn.example.com/ad.JPG")).toBe("image");
  });

  it("ignores the query string a signed URL carries", () => {
    // Supabase signed URLs put a token after the path; matching the whole
    // string would classify every one of them as unknown.
    expect(
      mediaKindFor("https://x.supabase.co/storage/v1/a.mp4?token=abc.def"),
    ).toBe("video");
    expect(
      mediaKindFor("https://x.supabase.co/storage/v1/a.png?token=abc.def"),
    ).toBe("image");
  });

  it("says unknown rather than guessing", () => {
    // Guessing image for a video uploads it to the wrong endpoint and fails
    // with an error about the file rather than about the guess.
    expect(mediaKindFor("https://cdn.example.com/creative")).toBe("unknown");
    expect(mediaKindFor("not a url")).toBe("unknown");
  });

  it("exposes a plain video check", () => {
    expect(isVideo("https://cdn.example.com/ad.mp4")).toBe(true);
    expect(isVideo("https://cdn.example.com/ad.png")).toBe(false);
  });
});
