import Image, { type ImageProps } from "next/image";

// Wraps next/image with `unoptimized` set for files served from /uploads/.
// Reason: Next.js's image optimizer fetches local /public/* via an internal
// loopback that snapshots the directory at build time. Files written there
// AFTER the build (i.e., user uploads) are invisible to the optimizer and
// it returns 400 "received null". Nginx serves /uploads/ directly with strong
// caching, so we skip Next's optimization for these paths.
export function UploadedImage(props: ImageProps) {
  return <Image {...props} unoptimized />;
}
