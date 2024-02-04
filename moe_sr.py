import re
import math
import traceback
from pathlib import Path

import eel
import numpy as np
import cv2

from onnx_infer import OnnxSRInfer

class ModelInfo:
    def __init__(self, name, path, scale, algo):
        self.name = name
        self.path = path
        self.scale = scale
        self.algo = algo


# Global Vars
model_list = []
sr_instance = None
port = 10721
# Scan models
model_root = Path('models')
for algo in ['real-esrgan', 'real-hatgan']:
    for folder in [p for p in (model_root / algo).iterdir() if p.is_dir()]:
        for f in folder.glob('*.onnx'):
            model_list.append(ModelInfo(str(f.stem), str(f), int(folder.stem.replace('x', '')), algo))

eel.init('webui', custom_js_func=['handleSetProgress', 'showError', 'handleSetProcessState'])
# prepare electron app
main_js = open('electron_app/main.js')
main_js_str = main_js.read()
main_js.close()
main_js_str_custom_port = re.sub('http://localhost:.*/', f'http://localhost:{port}/', main_js_str)
main_js = open('electron_app/main.js', 'w', encoding='utf-8')
main_js.write(main_js_str_custom_port)
main_js.close()


@eel.expose
def py_get_model_list(algo_name):
    models = [m.name for m in model_list if m.algo == algo_name]
    return models


def progress_setter(data):
    eel.handleSetProgress(round(data*100))


def show_error(error_text):
    eel.showError(error_text)


def set_process_state(state):
    eel.handleSetProcessState(state)


@eel.expose
def py_run_process(modelName, tileSize, scale, isSkipAlpha, resizeTo: str, inputType, inputImage, outputPath, gpuid):
    global sr_instance
    try:
        # find model info
        model = ModelInfo('', '', 4, '')
        provider_options = None
        if int(gpuid) >= 0:
            provider_options = [{'device_id': int(gpuid)}]
        for m in model_list:
            if m.name == modelName:
                model = m
                break
        # init or change sr instance
        if not sr_instance:
            sr_instance = OnnxSRInfer(model.path, model.scale, model.name,
                                      provider_options=provider_options, progress_setter=progress_setter)
        elif sr_instance.name != model.name:
            del sr_instance
            sr_instance = OnnxSRInfer(model.path, model.scale, model.name,
                                      provider_options=provider_options, progress_setter=progress_setter)
        # skip alpha sr
        if isSkipAlpha:
            sr_instance.alpha_upsampler = 'interpolation'
        
        # batch process
        imgs_in = []
        if inputType == 'Folder':
            input_folder = Path(inputImage)
            for f in input_folder.glob('*.jpg'):
                imgs_in.append(f)
            for f in input_folder.glob('*.png'):
                imgs_in.append(f)
        else:
            imgs_in = [inputImage]
        # sr process
        for img_in in imgs_in:
            img = cv2.imdecode(np.fromfile(img_in,dtype=np.uint8),cv2.IMREAD_UNCHANGED)
            h, w, c = img.shape
            sr_img = sr_instance.universal_process_pipeline(
                img, tile_size=tileSize)
            scale = int(scale)
            target_h = None
            target_w = None
            # scale >model scale: re process
            if scale > model.scale and model.scale != 1:
                # calc process times
                scale_log = math.log(scale, model.scale)
                total_times = math.ceil(scale_log)
                # calc target size
                if total_times != int(scale_log):
                    target_h = h*scale
                    target_w = w*scale

                for t in range(total_times-1):
                    sr_img = sr_instance.universal_process_pipeline(sr_img, tile_size=tileSize)
            elif scale < model.scale:
                target_h = h*scale
                target_w = w*scale
            # size in parameters first
            if resizeTo:
                if 'x' in resizeTo:
                    param_w = int(resizeTo.split('x')[0])
                    target_w = param_w
                    target_h = int(h * param_w / w)
                elif '/' in resizeTo:
                    ratio = int(resizeTo.split('/')[0]) / int(resizeTo.split('/')[1])
                    target_w = int(w * ratio)
                    target_h = int(h * ratio)
            if target_w:
                img_out = cv2.resize(sr_img, (target_w, target_h))
            else:
                img_out = sr_img
            # save
            img_in_name = Path(img_in).stem
            img_in_ext = Path(img_in).suffix
            final_output_path = Path(outputPath) / f'{img_in_name}_MoeSR_{model.name}.png'
            if final_output_path.exists():
                final_output_path = Path(outputPath) / f'{img_in_name}_{img_in_ext}_MoeSR_{model.name}.png'
            # cv2.imwrite(str(final_output_path), img_out)
            cv2.imencode('.png',img_out)[1].tofile(final_output_path)
        set_process_state('finish')
    except Exception as e:
        sr_instance = None
        error_message = traceback.format_exc()
        show_error(error_message)
        set_process_state('error')


eel.start('index.html', mode='custom', cmdline_args=['electron/electron.exe', 'electron_app/main.js'], port=port)
