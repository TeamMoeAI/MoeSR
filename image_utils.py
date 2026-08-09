from pathlib import Path

import numpy as np
from PIL import Image

PIL_INPUT_FORMATS = ("JPEG", "PNG", "WEBP", "AVIF")
_GRAYSCALE_MODES = {"1", "L", "I", "F", "I;16", "I;16B", "I;16L"}


def _grayscale_to_uint8(image):
    if image.mode in {"1", "L"}:
        return np.array(image.convert("L"), dtype=np.uint8, copy=True)

    pixels = np.asarray(image)
    if pixels.size == 0:
        return np.array(image.convert("L"), dtype=np.uint8, copy=True)

    if np.issubdtype(pixels.dtype, np.integer):
        minimum = int(pixels.min())
        maximum = int(pixels.max())
        if minimum >= 0 and maximum <= 255:
            return pixels.astype(np.uint8, copy=True)
        if minimum >= 0 and maximum <= 65535:
            normalized = np.rint(pixels.astype(np.float32) / 257.0)
            return np.clip(normalized, 0, 255).astype(np.uint8)

    return np.array(image.convert("L"), dtype=np.uint8, copy=True)


def load_image(path):
    """Decode a supported image as an 8-bit L, RGB, or RGBA NumPy array."""
    try:
        with Image.open(Path(path), formats=PIL_INPUT_FORMATS) as image:
            has_alpha = "A" in image.getbands() or "transparency" in image.info
            if has_alpha:
                return np.array(image.convert("RGBA"), dtype=np.uint8, copy=True)
            if image.mode in _GRAYSCALE_MODES:
                return _grayscale_to_uint8(image)
            return np.array(image.convert("RGB"), dtype=np.uint8, copy=True)
    except (Image.DecompressionBombError, OSError, ValueError):
        return None


def image_from_array(image):
    """Create a Pillow image from the project's L/RGB/RGBA array format."""
    image = np.asarray(image)
    if image.dtype != np.uint8:
        raise ValueError(f"Unsupported image dtype: {image.dtype}")
    if image.ndim == 2:
        pass
    elif image.ndim == 3 and image.shape[2] in {3, 4}:
        pass
    else:
        raise ValueError(f"Unsupported image shape: {image.shape}")
    return Image.fromarray(np.ascontiguousarray(image))


def resize_image(image, size, resample):
    """Resize an L/RGB/RGBA NumPy array and return a writable uint8 array."""
    width, height = size
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid image size: {size}")
    resized = image_from_array(image).resize((width, height), resample=resample)
    return np.array(resized, dtype=np.uint8, copy=True)
