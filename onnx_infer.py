import onnxruntime as ort
import cv2
import numpy as np
import math
import time

class OnnxSRInfer:

    def __init__(self, model_path,scale,name,
                 alpha_upsampler='sr model',providers=['DmlExecutionProvider'],provider_options=None,
                 progress_setter=None):
        """Onnx SR Infer

        Args:
            model_path (str): Model path
            scale (int): Model scale
            name (str): Instance name,used to determine whether to continue reusing this instance or destroy it when switching models.
            alpha_upsampler (str, optional): Method of SR the Alpha channel. Defaults to 'sr model'.Optionally "sr model" or "interpolation".
            providers (list, optional): Ort providers. Defaults to ['DmlExecutionProvider'].
            provider_options (list, optional): eg. [{'device_id': 0}]
            progress_setter: The function called when completing a block.(Used to communicate progress information)
        """
        self.sess = ort.InferenceSession(model_path,providers=providers,provider_options=provider_options)
        self.name = name
        self.scale = scale
        self.alpha_upsampler = alpha_upsampler
        self.progress_setter = progress_setter
        self.model_path = model_path
        self.total_img_num = 1
        self.processed_img_num = 0

    def img_array_norm_expd(self,img):
        img = np.array(img).astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))
        img = np.expand_dims(img, axis=0)
        return img
    def img_array_denorm_squeeze(self,img):
        output_image = np.squeeze(img)
        output_image = np.transpose(output_image, (1, 2, 0))
        output_image = (output_image * 255.0).clip(0, 255).astype(np.uint8)
        output_image = cv2.cvtColor(output_image, cv2.COLOR_RGB2BGR)
        return output_image
    
    def mod_pad(self, img, mod=16):
        """
        Pad image with reflect padding along the height and width axes, based on the modulus value.
        
        Args:
        img (np.array): The input image.
        mod (int): The modulus value to be used for padding. Default is 16.
        
        Returns:
        padded_img (np.array): The padded image.
        pad_height (int): The added padding height.
        pad_width (int): The added padding width.
        """
        mod_pad_h, mod_pad_w = 0, 0
        h, w, c = img.shape
        if (h % mod != 0):
            mod_pad_h = (mod - h % mod)
        if (w % mod != 0):
            mod_pad_w = (mod - w % mod)
        pad_img = np.pad(img, ((0, mod_pad_h), (0, mod_pad_w), (0, 0)), 'reflect')
        return pad_img, mod_pad_h, mod_pad_w

    def remove_mod_pad(self, img, pad_height, pad_width):
        h,w,c = img.shape
        return img[0:h-self.scale*pad_height, 0:w-self.scale*pad_width,:]
    
    def infer(self, img):
        """
        infer image
        Args:
            img (np.array)(h,w,c)
        return: img (np.array)(h,w,c)
        """
        img = self.img_array_norm_expd(img)
        img_sr = self.sess.run(['output'], {'input': img})[0]
        output = self.img_array_denorm_squeeze(img_sr)
        return output

    def tile_process(self, img, tile_size,tile_pad=16):
        """
        It will first crop input images to tiles, and then process each tile.
        Finally, all the processed tiles are merged into one images.
        Args:
            img (np.array)(h,w,c): image to be processed.
            tile_size (int): tile size.
            tile_pad (int):tile pad size.
        return: img (np.array)(h,w,c): processed image.
        Modified from: https://github.com/ata4/esrgan-launcher
        """
        height, width, channle = img.shape
        output_height = height * self.scale
        output_width = width * self.scale
        output_shape = ( output_height, output_width, channle)

        # start with black image
        output = np.zeros(output_shape, dtype=np.float32)
        tiles_x = math.ceil(width / tile_size)
        tiles_y = math.ceil(height / tile_size)

        # loop over all tiles
        for y in range(tiles_y):
            for x in range(tiles_x):
                # extract tile from input image
                ofs_x = x * tile_size
                ofs_y = y * tile_size
                # input tile area on total image
                input_start_x = ofs_x
                input_end_x = min(ofs_x + tile_size, width)
                input_start_y = ofs_y
                input_end_y = min(ofs_y + tile_size, height)

                # input tile area on total image with padding
                input_start_x_pad = max(input_start_x - tile_pad, 0)
                input_end_x_pad = min(input_end_x + tile_pad, width)
                input_start_y_pad = max(input_start_y - tile_pad, 0)
                input_end_y_pad = min(input_end_y + tile_pad, height)

                # input tile dimensions
                input_tile_width = input_end_x - input_start_x
                input_tile_height = input_end_y - input_start_y
                tile_idx = y * tiles_x + x + 1
                input_tile = img[input_start_y_pad:input_end_y_pad, input_start_x_pad:input_end_x_pad,:]

                # upscale tile
                output_tile = self.infer(input_tile)
                # output tile area on total image
                output_start_x = input_start_x * self.scale
                output_end_x = input_end_x * self.scale
                output_start_y = input_start_y * self.scale
                output_end_y = input_end_y * self.scale

                # output tile area without padding
                output_start_x_tile = (input_start_x - input_start_x_pad) * self.scale
                output_end_x_tile = output_start_x_tile + input_tile_width * self.scale
                output_start_y_tile = (input_start_y - input_start_y_pad) * self.scale
                output_end_y_tile = output_start_y_tile + input_tile_height * self.scale

                # put tile into output image
                output[output_start_y:output_end_y,output_start_x:output_end_x,:] \
                    = output_tile[output_start_y_tile:output_end_y_tile,output_start_x_tile:output_end_x_tile,:]
                self.progress_setter(tile_idx/tiles_x/tiles_y,time.time(),self.total_img_num,self.processed_img_num)

        return output
    def rgb_process_pipeline(self, image, tile_size):
        # mod pad
        pad_img,pad_h,pad_w = self.mod_pad(image)
        # tile process
        sr_img = self.tile_process(pad_img,tile_size)
        # remove pad
        final_img = self.remove_mod_pad(sr_img,pad_h,pad_w)
        return final_img
    
    def universal_process_pipeline(self, image,tile_size):
        img_mode = 'RGB'
        h,w,c = image.shape
        # handle RGBA image
        if c == 4:
            img_mode = 'RGBA'
            alpha = image[:, :,3]
            image = image[:, :,0:3]
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            if self.alpha_upsampler == 'sr model':
                alpha = cv2.cvtColor(alpha, cv2.COLOR_GRAY2RGB)
        else:
            image = cv2.cvtColor(image,cv2.COLOR_BGR2RGB)
        # process image (without alpha channel)
        output_img = self.rgb_process_pipeline(image,tile_size)
        # process alpha channel
        if img_mode == 'RGBA':
            if self.alpha_upsampler == 'sr model':
                alpha_img = self.rgb_process_pipeline(alpha,tile_size)
                output_alpha = cv2.cvtColor(alpha_img, cv2.COLOR_BGR2GRAY)
            else:  # use the cv2 resize for alpha channel
                output_alpha = cv2.resize(alpha, (w * self.scale, h * self.scale), interpolation=cv2.INTER_LINEAR)
            # merge the alpha channel
            output_img = cv2.cvtColor(output_img, cv2.COLOR_BGR2BGRA)
            output_img[:, :, 3] = output_alpha
        return output_img
