/**
 * Camera Module
 * Captures photos via <input capture="environment"> and resizes with canvas
 * Handles iOS page reload by using sessionStorage recovery
 */

const cameraInput = document.getElementById('camera-input');
let cameraResolve = null;
let cameraReject = null;
let cameraTimeout = null;

// Initialize camera listener
cameraInput.addEventListener('change', async (e) => {
  if (cameraTimeout) { clearTimeout(cameraTimeout); cameraTimeout = null; }

  const file = e.target.files[0];
  if (!file) {
    if (cameraReject) {
      cameraReject(new Error('未选择照片'));
    }
    cameraResolve = null;
    cameraReject = null;
    return;
  }

  try {
    const resizedBlob = await resizeImage(file, 1024, 0.7);
    const thumbBlob = await resizeImage(file, 200, 0.5);
    if (cameraResolve) {
      cameraResolve({ photo: resizedBlob, thumbnail: thumbBlob });
    }
  } catch (err) {
    if (cameraReject) cameraReject(err);
  }
  // Reset input so same file can be re-selected
  cameraInput.value = '';
  cameraResolve = null;
  cameraReject = null;
});

/**
 * Open camera to capture a photo
 * Falls back gracefully if camera is unavailable
 * @returns {Promise<{photo: Blob, thumbnail: Blob}>}
 */
function capturePhoto() {
  return new Promise((resolve, reject) => {
    cameraResolve = resolve;
    cameraReject = reject;

    // On iOS, if camera causes page reload, this timeout may never fire.
    // The sessionStorage 'pendingPhoto' flag handles recovery on reload.
    cameraTimeout = setTimeout(() => {
      if (cameraReject) {
        cameraReject(new Error('相机超时'));
        cameraResolve = null;
        cameraReject = null;
      }
    }, 120000); // 2 minute timeout

    // Must be in DOM for iOS - ensure it's clickable
    cameraInput.click();
  });
}

/**
 * Try to recover a pending photo operation after page reload
 * Called on app init
 */
async function recoverPendingPhoto() {
  const pending = sessionStorage.getItem('pendingPhoto');
  if (!pending) return;

  try {
    const { id, type } = JSON.parse(pending);
    // The record was already saved before camera opened.
    // Just clear the pending flag — user can add photo later from history.
    sessionStorage.removeItem('pendingPhoto');
    console.log('Cleared pending photo for record:', id, type);
  } catch (e) {
    sessionStorage.removeItem('pendingPhoto');
  }
}

/**
 * Skip photo - resolve with nulls
 * @returns {{photo: null, thumbnail: null}}
 */
function skipPhoto() {
  return { photo: null, thumbnail: null };
}

/**
 * Resize an image file to fit within maxDimension while maintaining aspect ratio
 * @param {File|Blob} file - Source image file
 * @param {number} maxDimension - Max width or height in pixels
 * @param {number} quality - JPEG quality 0-1
 * @returns {Promise<Blob>}
 */
function resizeImage(file, maxDimension, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      // Only resize if image is larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Use better image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('图片处理失败'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/**
 * Create an object URL from a blob for display in <img>
 * @param {Blob} blob
 * @returns {string}
 */
function blobToUrl(blob) {
  if (!blob) return '';
  return URL.createObjectURL(blob);
}

/**
 * Revoke an object URL to free memory
 * @param {string} url
 */
function revokeBlobUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
