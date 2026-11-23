/** Read a local video file's duration (seconds) from its metadata, or null if unknown. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done(v.duration);
      // Some WebM files report no duration until the browser scans to the end.
      v.ondurationchange = () => Number.isFinite(v.duration) && done(v.duration);
      v.currentTime = 1e101;
    };
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = url;
  });
}
