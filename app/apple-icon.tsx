import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ikonet på iPhone-hjemmeskærmen. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#383b42",
          color: "#f6f6f7",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        CP
      </div>
    ),
    size
  );
}
