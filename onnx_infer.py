import onnxruntime as ort
import numpy as np
import math
import time

from PIL import Image

from image_utils import image_from_array, resize_image


class OnnxSRInfer:

    def __init__(self, model_path, scale, name, precision='fp32',
                 alpha_upsampler='sr model', providers=['DmlExecutionProvider'], provider_options=None,
                 progress_setter=None):
        """Onnx SR Infer

        Args:
            model_path (str): Model path
            scale (int): Model scale
            name (str): Instance name,used to determine whether to continue reusing this instance or destroy it when switching models.
            precision (str, optional): Model precision. 'fp32' or 'fp16'
            alpha_upsampler (str, optional): Method of SR the Alpha channel. Defaults to 'sr model'.Optionally "sr model" or "interpolation".
            providers (list, optional): Ort providers. Defaults to ['DmlExecutionProvider'].
            provider_options (list, optional): eg. [{'device_id': 0}]
            progress_setter: The function called when completing a block.(Used to communicate progress information)
        """
        self.sess = ort.InferenceSession(model_path, providers=providers, provider_options=provider_options)
        self.name = name
        self.scale = scale
        self.precision = precision
        self.alpha_upsampler = alpha_upsampler
        self.progress_setter = progress_setter
        self.model_path = model_path
        self.total_img_num = 1
        self.processed_img_num = 0

    def img_array_norm_expd(self, img):
        img = np.array(img).astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)
        return img

    def img_array_denorm_squeeze(self, img):
        output_image = np.squeeze(img)
        output_image = np.transpose(output_image, (1, 2, 0))
        output_image = (output_image * 255.0).clip(0, 255).astype(np.uint8)
        return output_image

    def pre_process(self, img, tile_size, tile_pad):
        """
        Pre-process the image before enhancement.
        Pads the image to be divisible by tile_size and adds a border.
        Args:
            img (np.array): The input image (h, w, c).
            tile_size (int): The tile size.
            tile_pad (int): The tile padding.
        Returns:
            tuple: Padded image (np.array), padding height (int), padding width (int).
        """
        h, w, c = img.shape

        pad_h = (tile_size - h % tile_size) % tile_size
        pad_w = (tile_size - w % tile_size) % tile_size

        # Pad to be divisible by tile_size, then add tile_pad for border handling.
        # np.pad format is ((top, bottom), (left, right), (channel_before, channel_after))
        img = np.pad(img,
                     ((tile_pad, pad_h + tile_pad), (tile_pad, pad_w + tile_pad), (0, 0)),
                     'reflect')

        return img, pad_h, pad_w

    def post_process(self, img, pad_h, pad_w, tile_pad):
        """
        Post-process the image to remove padding.
        Args:
            img (np.array): The input image.
            pad_h (int): The padding height to remove.
            pad_w (int): The padding width to remove.
            tile_pad (int): The tile padding to remove.
        Returns:
            np.array: The processed image.
        """
        h, w, c = img.shape

        # Calculate the crop boundaries
        top = tile_pad * self.scale
        left = tile_pad * self.scale
        bottom = h - (pad_h + tile_pad) * self.scale
        right = w - (pad_w + tile_pad) * self.scale

        # Crop the image to remove all padding
        img = img[top:bottom, left:right, :]
        return img

    def infer(self, img):
        """
        infer image
        Args:
            img (np.array)(h,w,c)
        return: img (np.array)(h,w,c)
        """
        img = self.img_array_norm_expd(img)
        if self.precision == 'fp16':
            img = np.array(img, dtype=np.float16)
        img_sr = self.sess.run(['output'], {'input': img})[0]
        output = self.img_array_denorm_squeeze(img_sr)
        return output

    def tile_process(self, img, tile_size, tile_pad=8):
        """
        Process the image using tile processing.
        Crops the image into tiles, processes each tile, and merges them.
        Args:
            img (np.array)(h,w,c): image to be processed.
            tile_size (int): tile size.
            tile_pad (int):tile pad size.
        return: img (np.array)(h,w,c): processed image.
        """
        h, w, c = img.shape
        output_h = h * self.scale
        output_w = w * self.scale
        output_shape = (output_h, output_w, c)

        # start with a black image
        output = np.zeros(output_shape, dtype=np.uint8)

        # Calculate the number of tiles based on the image size without the tile_pad border.
        # The input 'img' is already padded by pre_process.
        tiles_x = math.ceil((w - 2 * tile_pad) / tile_size)
        tiles_y = math.ceil((h - 2 * tile_pad) / tile_size)

        # loop over all tiles
        for y in range(tiles_y):
            for x in range(tiles_x):
                # equivalent to cutting out the Tilesize from the original image.
                x_start = x * tile_size + tile_pad
                y_start = y * tile_size + tile_pad
                x_end = min(x_start + tile_size, w - tile_pad)
                y_end = min(y_start + tile_size, h - tile_pad)

                # Add padding to the tile for inference.
                x_start_pad = x_start - tile_pad
                y_start_pad = y_start - tile_pad
                x_end_pad = x_end + tile_pad
                y_end_pad = y_end + tile_pad

                # Crop the tile with padding.
                tile = img[y_start_pad:y_end_pad, x_start_pad:x_end_pad, :]

                tile_output = self.infer(tile)

                # Calculate the region to crop from the upscaled tile.
                crop_y_start = (y_start - y_start_pad) * self.scale
                crop_x_start = (x_start - x_start_pad) * self.scale
                crop_y_end = crop_y_start + (y_end - y_start) * self.scale
                crop_x_end = crop_x_start + (x_end - x_start) * self.scale

                cropped_tile_output = tile_output[crop_y_start:crop_y_end, crop_x_start:crop_x_end, :]

                # Place the processed tile into the output image.
                output[y_start * self.scale:y_end * self.scale, x_start * self.scale:x_end * self.scale, :] = cropped_tile_output

                # Update progress
                tile_idx = y * tiles_x + x + 1
                if self.progress_setter:
                    self.progress_setter(tile_idx / (tiles_x * tiles_y), time.time(), self.total_img_num, self.processed_img_num)

        return output

    def rgb_process_pipeline(self, image, tile_size, tile_pad=8):
        img, pad_h, pad_w = self.pre_process(image, tile_size, tile_pad)
        output = self.tile_process(img, tile_size, tile_pad)
        final_img = self.post_process(output, pad_h, pad_w, tile_pad)
        return final_img

    def universal_process_pipeline(self, image, tile_size, tile_pad=8):
        img_mode = 'RGB'

        # handle grayscale image
        if image.ndim == 2:
            image = np.repeat(image[:, :, np.newaxis], 3, axis=2)
        elif image.ndim != 3:
            raise ValueError(f'Unsupported image shape: {image.shape}')

        h, w, c = image.shape
        # handle RGBA image
        if c == 4:
            img_mode = 'RGBA'
            alpha = image[:, :, 3]
            image = image[:, :, 0:3]
            if self.alpha_upsampler == 'sr model':
                alpha = np.repeat(alpha[:, :, np.newaxis], 3, axis=2)
        elif c != 3:
            raise ValueError(f'Unsupported image channel count: {c}')

        # process image (without alpha channel)
        output_img = self.rgb_process_pipeline(image, tile_size, tile_pad)
        # process alpha channel
        if img_mode == 'RGBA':
            if self.alpha_upsampler == 'sr model':
                alpha_img = self.rgb_process_pipeline(alpha, tile_size, tile_pad)
                output_alpha = np.array(
                    image_from_array(alpha_img).convert('L'),
                    dtype=np.uint8,
                    copy=True,
                )
            else:
                output_alpha = resize_image(
                    alpha,
                    (w * self.scale, h * self.scale),
                    Image.Resampling.BILINEAR,
                )
            # merge the alpha channel
            output_img = np.dstack((output_img, output_alpha))
        return output_img
