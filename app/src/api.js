export async function getHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

/**
 * Uploads a take with progress. XHR (not fetch) because fetch has no upload progress,
 * and on Indian mobile data a 60 MB reel can take a while — people need to see it moving.
 */
export function uploadTake(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('video', file, file.name || 'take.mp4');
    xhr.open('POST', '/api/takes');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      xhr.status < 300 ? resolve(body) : reject(new Error(body.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection and try again'));
    xhr.send(form);
  });
}
