/**
 * Downscales an uploaded avatar before it is stored.
 *
 * A full-size photo as a data URL runs to several megabytes and would exhaust
 * the localStorage quota, taking the saved draft down with it. 128px is more
 * than the preview renders at.
 */
export function downscaleImage(file, size = 128) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode that image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Square centre-crop, which is how LinkedIn renders a profile photo.
        const edge = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - edge) / 2,
          (img.height - edge) / 2,
          edge,
          edge,
          0,
          0,
          size,
          size
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
