import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Video",
    short_name: "Video",
    display: "fullscreen",
    start_url: "/fs",
    background_color: "#000000",
    theme_color: "#000000",
  };
}
