import math
import os
import logging
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import json
import time

import numpy as np
import cv2

from onnx_infer import OnnxSRInfer
from gpu_enum import GPUEnum, select_better_gpu


logger = logging.getLogger("moesr.moe_sr")


class ModelInfo:

    def __init__(self, name, path, scale, algo, precision="fp32"):
        self.name = name
        self.path = str(path)
        self.scale = scale
        self.algo = algo
        self.precision = precision


class ModelManager:

    def __init__(self, model_root="models"):
        self.model_root = Path(model_root)
        self.model_list: list[ModelInfo] = self._scan_models()

    def _scan_models(self):
        models = []
        for model_file in self.model_root.rglob("*.onnx"):
            try:
                # model_file.parts an tuple like: ('E:', 'MoeSR', 'models', 'real-esrgan', 'x4', 'model.onnx')
                # The last three parts are what we need.
                scale_dir_name = model_file.parts[-2]
                algo_name = model_file.parts[-3]
                scale = int(scale_dir_name.replace("x", ""))
                precision = "fp32"
                if "fp16" in model_file.stem:
                    precision = "fp16"
                models.append(ModelInfo(model_file.stem, model_file, scale, algo_name, precision))
            except Exception:
                logger.warning("Skipping unresolvable model path: %s", model_file, exc_info=True)
                continue
        return models

    def find_model(self, name, algo) -> ModelInfo:
        for model in self.model_list:
            if model.name == name and model.algo == algo:
                return model
        return None

    def get_models_by_algo(self, algo_name):
        return [m.name for m in self.model_list if m.algo == algo_name]


class SRManager:

    def __init__(self, model_manager):
        self.model_manager = model_manager
        self._sr_instance = None
        # Use file path to determine unique values to avoid multiple judgments
        self._current_model_path = None
        self._current_gpuid = None

    def get_instance(self, model_name, algo_name, gpuid, progress_setter):
        model_info: ModelInfo = self.model_manager.find_model(model_name, algo_name)
        if (self._sr_instance is None or self._current_model_path != model_info.path or self._current_gpuid != gpuid):

            logger.info("Creating/switching SR instance: model=%s, gpu=%s", model_info.path, gpuid)
            if self._sr_instance:
                del self._sr_instance

            provider_options = [{"device_id": gpuid}] if gpuid >= 0 else None
            self._sr_instance = OnnxSRInfer(
                model_info.path,
                model_info.scale,
                model_info.name,
                model_info.precision,
                provider_options=provider_options,
                progress_setter=progress_setter,
            )
            self._current_model_path = model_info.path
            self._current_gpuid = gpuid

        return self._sr_instance, model_info

    def reset(self):
        if self._sr_instance:
            del self._sr_instance
        self._sr_instance = None
        self._current_model_path = None
        self._current_gpuid = None


class WorkflowSRManager:
    """SR Manager that caches multiple models for workflow use"""

    def __init__(self, model_manager):
        self.model_manager = model_manager
        # Cache: key = (model_path, gpuid), value = sr_instance
        self._sr_instances = {}

    def get_instance(self, model_name, algo_name, gpuid, progress_setter):
        model_info: ModelInfo = self.model_manager.find_model(model_name, algo_name)
        cache_key = (model_info.path, gpuid)

        if cache_key not in self._sr_instances:
            logger.info("Creating cached SR instance: model=%s, gpu=%s", model_info.path, gpuid)
            provider_options = [{"device_id": gpuid}] if gpuid >= 0 else None
            self._sr_instances[cache_key] = OnnxSRInfer(
                model_info.path,
                model_info.scale,
                model_info.name,
                model_info.precision,
                provider_options=provider_options,
                progress_setter=progress_setter,
            )
        else:
            # Update progress_setter for existing instance
            self._sr_instances[cache_key].progress_setter = progress_setter
            logger.debug("Reusing cached SR instance: model=%s, gpu=%s", model_info.path, gpuid)

        return self._sr_instances[cache_key], model_info

    def reset(self):
        for instance in self._sr_instances.values():
            del instance
        self._sr_instances = {}


DEFAULT_SETTINGS = {
    "language": "English",
    "alwaysShowAdvanced": False,
    "customFilenameFormat": "{filestem}_MoeSR_x{scale}_{model_name}.png",
    "rememberOptions": False,
    "defaultOutputPath": False,
    "workflowKeepModels": False,
    "imageEncoder": "png",
    "pngCompressionLevel": 1,
    "oxipngCompressionLevel": 2,
    "webpCompressionLevel": 80,
    "quickWorkflowName": "",
}
SUPPORTED_INPUT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
SLIDING_WINDOW_SIZE = 5


class MoeSRService:

    def __init__(self, data_dir, frontend_bridge):
        self.data_dir = Path(data_dir)
        self.model_dir = self.data_dir / "models"
        self.settings_path = self.data_dir / "settings.json"
        self.workflow_dir = self.data_dir / "workflows"
        self.frontend = frontend_bridge
        self.progress_state = {}

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.workflow_dir.mkdir(parents=True, exist_ok=True)
        if not self.model_dir.is_dir():
            raise FileNotFoundError(f"Model directory not found: {self.model_dir}")

        self.model_manager = ModelManager(self.model_dir)
        self.sr_manager = SRManager(self.model_manager)
        self.workflow_sr_manager = WorkflowSRManager(self.model_manager)

        try:
            gpu_enumerator = GPUEnum()
            self.gpu_dict = gpu_enumerator.gpu_dict()
            self.gpu_list = gpu_enumerator.gpu_list()
        except Exception:
            logger.warning("GPU enumeration failed; using fallback GPU IDs", exc_info=True)
            self.gpu_dict = None
            self.gpu_list = [str(i) for i in range(16)]

    def _progress_setter(self, progress, current_time, total_img_num, processed_img_num):
        state = self.progress_state

        progress_percent = round(progress * 100)
        total_progress_percent = round((processed_img_num + progress) / total_img_num * 100)

        etr_str = "--:--:--"
        total_etr_str = "--:--:--"

        # Initialize history list for sliding window
        if "history" not in state:
            state["history"] = []

        history = state["history"]
        history.append({"progress": progress, "time": current_time})

        # Keep window size
        if len(history) > SLIDING_WINDOW_SIZE:
            history.pop(0)

        # Calculate average speed using sliding window
        if len(history) >= 2:
            oldest = history[0]
            newest = history[-1]

            time_delta = newest["time"] - oldest["time"]
            progress_delta = newest["progress"] - oldest["progress"]

            if progress_delta > 1e-6 and time_delta > 0:
                speed = progress_delta / time_delta  # progress per second
                remaining_progress = 1 - progress
                etr = remaining_progress / speed

                total_remaining = total_img_num - processed_img_num - progress
                total_etr = total_remaining / speed

                etr_str = seconds_to_hms(etr)
                total_etr_str = seconds_to_hms(total_etr)

        progress_str = f"{progress_percent}% ETR:{etr_str}"
        total_progress_str = f"{total_progress_percent}% ETR:{total_etr_str}"
        self.frontend.handleSetProgress(progress_percent, progress_str, total_progress_str)

    def _workflow_progress_setter(
        self,
        step_progress,
        current_time,
        node_index,
        node_type,
        processed_img_num,
        total_img_num,
    ):
        """Workflow progress callback - uses same format as normal progress_setter

        Args:
            step_progress: Current inference node tile progress (0-1), -1 for non-inference nodes
            current_time: Current timestamp
            node_index: Current node index (1-based)
            node_type: Current node type (inference/scale/label/jump/conditional_jump)
            processed_img_num: Number of processed images
            total_img_num: Total number of images
        """
        state = self.progress_state

        etr_str = "--:--:--"
        step_percent = 0

        # Calculate ETR using sliding window (only for inference nodes)
        if step_progress >= 0:
            step_percent = round(step_progress * 100)

            if "history" not in state:
                state["history"] = []

            history = state["history"]
            history.append({"progress": step_progress, "time": current_time})

            if len(history) > SLIDING_WINDOW_SIZE:
                history.pop(0)

            if len(history) >= 2:
                oldest = history[0]
                newest = history[-1]
                time_delta = newest["time"] - oldest["time"]
                progress_delta = newest["progress"] - oldest["progress"]
                if progress_delta > 1e-6 and time_delta > 0:
                    speed = progress_delta / time_delta
                    remaining_progress = 1 - step_progress
                    etr = remaining_progress / speed
                    etr_str = seconds_to_hms(etr)

        # Format node type display
        node_type_display = node_type.capitalize()
        if node_type == "conditional_jump":
            node_type_display = "Conditional"

        # Format progress text: "Node 5: Inference - 45% ETR:00:01:23" or "Node 3: Scale"
        if node_type == "inference" and step_progress >= 0:
            progress_str = f"Node {node_index}: {node_type_display} - {step_percent}% ETR:{etr_str}"
        else:
            progress_str = f"Node {node_index}: {node_type_display}"

        # Total progress for batch processing
        total_progress_percent = round(processed_img_num / total_img_num * 100) if total_img_num > 0 else 0
        total_progress_str = f"{processed_img_num}/{total_img_num} ({total_progress_percent}%)"

        # Use same callback as normal inference
        self.frontend.handleSetProgress(step_percent, progress_str, total_progress_str)

    def _set_process_state(self, state):
        self.frontend.handleSetProcessState(state)

    def _parse_gpu_str(self, gpu):
        preset_ids = [str(i) for i in range(16)]
        if gpu in preset_ids:
            return int(gpu)
        elif self.gpu_dict:
            gpu_id = self.gpu_dict[gpu]
            return gpu_id
        else:
            return 0

    @staticmethod
    def _get_unique_filename(filepath):
        counter = 1
        new_filepath = filepath

        while new_filepath.exists():
            new_filepath = filepath.with_name(f"{filepath.stem}_{counter}{filepath.suffix}")
            counter += 1
        return new_filepath

    def py_get_model_list(self, algo_name):
        return self.model_manager.get_models_by_algo(algo_name)

    def py_get_all_models(self):
        """Get all models with algorithm info for workflow"""
        result = []
        for model in self.model_manager.model_list:
            result.append({
                "name": model.name,
                "algo": model.algo,
                "scale": model.scale,
                "displayName": f"{model.algo}: {model.name}"
            })
        return result

    def py_get_gpu_list(self):
        return select_better_gpu(self.gpu_list)

    def py_get_settings(self):
        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                return {**DEFAULT_SETTINGS, **json.load(f)}
        except (FileNotFoundError, json.JSONDecodeError):
            return DEFAULT_SETTINGS.copy()

    def py_save_settings(self, new_settings):
        try:
            get_image_encoding_settings({**DEFAULT_SETTINGS, **new_settings})
            self.settings_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.settings_path, "w", encoding="utf-8") as f:
                json.dump(new_settings, f, ensure_ascii=False, indent=4)
            return 0
        except Exception:
            logger.exception("Failed to save settings")
            return -1

    def py_get_workflow_list(self):
        """Get list of saved workflows"""
        self.workflow_dir.mkdir(exist_ok=True)

        workflows = []
        for file in self.workflow_dir.glob("*.json"):
            workflows.append(file.stem)
        return workflows

    def py_load_workflow(self, name):
        """Load a workflow by name"""
        try:
            workflow_path = self.workflow_dir / f"{name}.json"
            if workflow_path.exists():
                with open(workflow_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            return None
        except Exception:
            logger.exception("Failed to load workflow: %s", name)
            return None

    def py_save_workflow(self, name, data):
        """Save a workflow"""
        try:
            self.workflow_dir.mkdir(exist_ok=True)

            workflow_path = self.workflow_dir / f"{name}.json"
            with open(workflow_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            return True
        except Exception:
            logger.exception("Failed to save workflow: %s", name)
            return False

    def py_run_process(
        self,
        modelName,
        tileSize,
        scale,
        isSkipAlpha,
        resizeTo,
        inputType,
        inputImage,
        outputPath,
        gpuid,
        algoName,
        scalingMode="manual",
        targetResolution="",
    ):
        # scalingMode: manual/target
        self.progress_state = {"last_progress": None, "last_time": None}

        save_pipeline = None
        try:
            # Load custom filename format from settings
            settings = self.py_get_settings()
            custom_filename_format = settings.get("customFilenameFormat", "{filestem}_MoeSR_x{scale}_{model_name}.png")
            encoding = get_image_encoding_settings(settings)
            save_pipeline = ImageSavePipeline(encoding)

            # fix params
            if algoName == "moe-ir":
                tileSize = 256 - 16
                scale = 1

            # parse ui gpu str
            real_gpu_id = self._parse_gpu_str(gpuid)
            sr_instance, model = self.sr_manager.get_instance(
                modelName, algoName, int(real_gpu_id), self._progress_setter
            )
            sr_instance.alpha_upsampler = "interpolation" if isSkipAlpha else "default"

            if inputType == "Folder":
                input_folder = Path(inputImage)
                imgs_in = get_input_images(input_folder)
            else:
                imgs_in = [Path(inputImage)]

            if not imgs_in:
                return

            sr_instance.total_img_num = len(imgs_in)
            sr_instance.processed_img_num = 0

            for img_path in imgs_in:
                self.progress_state = {"last_progress": None, "last_time": None}

                img = cv2.imdecode(np.fromfile(img_path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
                if img is None:
                    logger.warning("Unable to load image; skipped: %s", img_path)
                    sr_instance.processed_img_num += 1
                    continue

                h, w = img.shape[:2]
                sr_img = sr_instance.universal_process_pipeline(img, tile_size=tileSize)

                # calc target scale
                if scalingMode == "target":
                    parts = targetResolution.lower().split("x")
                    scale = math.ceil(int(parts[0]) / w)

                # Target scale > model scale, repeat the process
                if scale > model.scale and model.scale > 1:
                    scale_log = math.log(scale, model.scale)
                    total_times = math.ceil(scale_log)
                    for _ in range(total_times - 1):
                        sr_img = sr_instance.universal_process_pipeline(sr_img, tile_size=tileSize)
                sr_h, sr_w = sr_img.shape[:2]

                # resize
                target_h, target_w = None, None

                if scalingMode == "target":
                    target_w, target_h = parse_resolution_str(targetResolution, w, h)
                elif scalingMode == "manual" and resizeTo:
                    target_w, target_h = parse_resolution_str(resizeTo, w, h)
                # No 'resizeTo' set, but 'ui scale' is not equal to the 'model scale'
                elif scalingMode == "manual" and sr_w != w * scale:
                    target_w = int(w * scale)
                    target_h = int(h * scale)

                if target_w and target_h:
                    # need to use the final image after super-resolution
                    if sr_w > target_w:
                        # reduce
                        img_out = cv2.resize(
                            sr_img, (target_w, target_h), interpolation=cv2.INTER_AREA
                        )
                    else:
                        img_out = cv2.resize(
                            sr_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4
                        )
                else:
                    img_out = sr_img

                # save image
                save_pipeline.wait()
                output_folder = Path(outputPath)
                output_folder.mkdir(parents=True, exist_ok=True)
                base_name = img_path.stem

                # Use custom filename format
                output_filename = format_output_filename(
                    custom_filename_format,
                    filestem=base_name,
                    scale=scale,
                    model_name=model.name,
                )
                final_output_path = (output_folder / output_filename).with_suffix(
                    save_pipeline.output_extension
                )

                if final_output_path.exists():
                    final_output_path = self._get_unique_filename(final_output_path)

                save_pipeline.submit(img_out, final_output_path)
                sr_instance.processed_img_num += 1

            self.frontend.handleSetProgress(100, "Saving image...", "100% ETR:--:--:--")
            save_pipeline.wait()
            self._set_process_state("finish")

        except Exception:
            self.sr_manager.reset()
            logger.exception("Image processing failed")
            self._set_process_state("error")
        finally:
            if save_pipeline is not None:
                save_pipeline.shutdown()


    def py_run_workflow(self, workflow_data):
        """Execute workflow pipeline"""
        self.progress_state = {"last_progress": None, "last_time": None}
        save_pipeline = None
        active_sr_manager = self.sr_manager

        try:
            # Load settings
            settings = self.py_get_settings()
            custom_filename_format = settings.get("customFilenameFormat", "{filestem}_MoeSR_x{scale}_{model_name}.png")
            keep_models = settings.get("workflowKeepModels", False)
            encoding = get_image_encoding_settings(settings)
            save_pipeline = ImageSavePipeline(encoding)

            # Choose SR manager based on setting
            active_sr_manager = self.workflow_sr_manager if keep_models else self.sr_manager

            # Parse input
            input_config = workflow_data.get("input", {})
            output_config = workflow_data.get("output", {})
            nodes = workflow_data.get("nodes", [])

            input_path = input_config.get("path", "")
            input_type = input_config.get("inputType", "Image")
            output_path = output_config.get("path", "")

            if not input_path or not output_path:
                self._set_process_state("error")
                return

            # Load images
            if input_type == "Folder":
                input_folder = Path(input_path)
                imgs_in = get_input_images(input_folder)
            else:
                imgs_in = [Path(input_path)]

            if not imgs_in:
                self._set_process_state("finish")
                return

            total_img_num = len(imgs_in)
            processed_img_num = 0

            # Build label index map
            label_index_map = {}
            for i, node in enumerate(nodes):
                if node.get("type") == "label":
                    label_name = node.get("config", {}).get("name", "")
                    if label_name:
                        label_index_map[label_name] = i

            # Process each image
            for img_path in imgs_in:
                self.progress_state = {"last_progress": None, "last_time": None}

                img = cv2.imdecode(np.fromfile(img_path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
                if img is None:
                    logger.warning("Unable to load image; skipped: %s", img_path)
                    processed_img_num += 1
                    continue

                current_scale = 1
                last_model_name = "unknown"

                # Execute workflow nodes
                current_index = 0
                max_steps = 1000  # Prevent infinite loops
                step_count = 0

                while current_index < len(nodes) and step_count < max_steps:
                    step_count += 1
                    node = nodes[current_index]
                    node_type = node.get("type", "")
                    config = node.get("config", {})

                    # Send progress update for non-inference nodes
                    if node_type != "inference":
                        self._workflow_progress_setter(
                            -1, time.time(), current_index + 1, node_type,
                            processed_img_num, total_img_num
                        )

                    if node_type == "inference":
                        # Reset history for new inference node
                        self.progress_state = {"history": []}

                        # Run inference
                        algo_name = config.get("algoName", "")
                        model_name = config.get("modelName", "")
                        tile_size = config.get("tileSize", 64)
                        gpu_id = config.get("gpuId", "0")
                        skip_alpha = config.get("skipAlpha", False)

                        if algo_name == "moe-ir":
                            tile_size = 256 - 16

                        real_gpu_id = self._parse_gpu_str(gpu_id)

                        # Capture current node index for closure
                        _node_index = current_index + 1
                        _total_img_num = total_img_num
                        _processed_img_num = processed_img_num

                        def make_workflow_progress_callback(node_idx, total_imgs, processed_imgs):
                            def callback(progress, current_time, total, processed):
                                self._workflow_progress_setter(
                                    progress, current_time, node_idx, "inference",
                                    processed_imgs, total_imgs
                                )
                            return callback

                        progress_callback = make_workflow_progress_callback(
                            _node_index, _total_img_num, _processed_img_num
                        )

                        sr_instance, model = active_sr_manager.get_instance(
                            model_name, algo_name, int(real_gpu_id), progress_callback
                        )
                        sr_instance.alpha_upsampler = "interpolation" if skip_alpha else "default"
                        sr_instance.total_img_num = 1
                        sr_instance.processed_img_num = 0

                        img = sr_instance.universal_process_pipeline(img, tile_size=tile_size)
                        current_scale *= model.scale
                        last_model_name = model.name
                        current_index += 1

                    elif node_type == "scale":
                        # Run scale
                        value = config.get("value", "")
                        if value:
                            h, w = img.shape[:2]
                            result = parse_resolution_str(value, w, h)
                            if result:
                                target_w, target_h = result
                                if w > target_w:
                                    img = cv2.resize(
                                        img, (target_w, target_h), interpolation=cv2.INTER_AREA
                                    )
                                else:
                                    img = cv2.resize(
                                        img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4
                                    )
                        current_index += 1

                    elif node_type == "label":
                        # Label node, just continue
                        current_index += 1

                    elif node_type == "jump":
                        # Unconditional jump
                        jump_to = config.get("jumpTo", "")
                        if jump_to and jump_to in label_index_map:
                            current_index = label_index_map[jump_to]
                        else:
                            current_index += 1

                    elif node_type == "conditional_jump":
                        # Conditional jump
                        h, w = img.shape[:2]
                        condition_type = config.get("conditionType", "width")
                        operator = config.get("operator", "gt")
                        compare_value = config.get("value", 0)
                        true_jump = config.get("trueJumpTo", "")
                        false_jump = config.get("falseJumpTo", "")

                        # Get actual value
                        if condition_type == "width":
                            actual_value = w
                        else:  # height
                            actual_value = h

                        # Evaluate condition
                        condition_met = False
                        if operator == "gt":
                            condition_met = actual_value > compare_value
                        elif operator == "lt":
                            condition_met = actual_value < compare_value
                        elif operator == "eq":
                            condition_met = actual_value == compare_value

                        # Jump based on condition
                        if condition_met and true_jump and true_jump in label_index_map:
                            current_index = label_index_map[true_jump]
                        elif not condition_met and false_jump and false_jump in label_index_map:
                            current_index = label_index_map[false_jump]
                        else:
                            current_index += 1
                    else:
                        current_index += 1

                # Save output
                save_pipeline.wait()
                output_folder = Path(output_path)
                output_folder.mkdir(parents=True, exist_ok=True)
                base_name = img_path.stem

                output_filename = format_output_filename(
                    custom_filename_format,
                    filestem=base_name,
                    scale=current_scale,
                    model_name=last_model_name,
                )
                final_output_path = (output_folder / output_filename).with_suffix(
                    save_pipeline.output_extension
                )

                if final_output_path.exists():
                    final_output_path = self._get_unique_filename(final_output_path)

                save_pipeline.submit(img, final_output_path)
                processed_img_num += 1

            self.frontend.handleSetProgress(
                100, "Saving image...", f"{processed_img_num}/{total_img_num} (100%)"
            )
            save_pipeline.wait()
            self._set_process_state("finish")

        except Exception:
            active_sr_manager.reset()
            logger.exception("Workflow execution failed")
            self._set_process_state("error")
        finally:
            if save_pipeline is not None:
                save_pipeline.shutdown()


    def py_run_quick_workflow(self, workflow_name, source_path):
        workflow_data = self.py_load_workflow(workflow_name)
        if workflow_data is None:
            raise ValueError(f"Workflow not found: {workflow_name}")

        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"Input path not found: {source}")
        if source.is_file() and source.suffix.lower() not in SUPPORTED_INPUT_EXTENSIONS:
            raise ValueError(f"Unsupported image type: {source.suffix}")

        quick_workflow = deepcopy(workflow_data)
        input_type = "Folder" if source.is_dir() else "Image"
        output_folder = (source if source.is_dir() else source.parent) / "MoeSR_output"

        quick_workflow["input"] = {
            "path": str(source),
            "inputType": input_type,
        }
        quick_workflow["output"] = {
            **quick_workflow.get("output", {}),
            "path": str(output_folder),
        }
        return self.py_run_workflow(quick_workflow)


def seconds_to_hms(seconds):
    if seconds is None or seconds < 0:
        return "--:--:--"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    return f"{hours:0>2d}:{minutes:0>2d}:{seconds:0>2d}"


def format_output_filename(template: str, filestem: str, scale: int, model_name: str) -> str:
    """
    Format output filename based on template with placeholders.
    Supported placeholders: {filestem}, {scale}, {model_name}
    Truncates filename to 260 characters if exceeded.
    """
    filename = template.replace("{filestem}", filestem)
    filename = filename.replace("{scale}", str(scale))
    filename = filename.replace("{model_name}", model_name)

    # Truncate filename if it exceeds 260 characters (Windows MAX_PATH limit)
    if len(filename) > 260:
        # Preserve file extension
        ext_start = filename.rfind(".")
        if ext_start > 0:
            ext = filename[ext_start:]
            filename = filename[:260 - len(ext)] + ext
        else:
            filename = filename[:260]

    return filename


def get_input_images(input_path: Path):
    return sorted(
        path for path in input_path.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_INPUT_EXTENSIONS
    )


def get_image_encoding_settings(settings):
    encoder = settings.get("imageEncoder", "png")
    level_keys = {
        "png": ("pngCompressionLevel", 0, 9, 1),
        "oxipng": ("oxipngCompressionLevel", 0, 6, 2),
        "webp": ("webpCompressionLevel", 0, 100, 80),
    }
    if encoder not in level_keys:
        raise ValueError(f"Unsupported image encoder: {encoder}")

    key, minimum, maximum, default = level_keys[encoder]
    try:
        level = int(settings.get(key, default))
    except (TypeError, ValueError) as error:
        raise ValueError(f"Invalid {key}") from error

    if not minimum <= level <= maximum:
        raise ValueError(f"{key} must be between {minimum} and {maximum}")

    return {"encoder": encoder, "level": level}


class ImageSavePipeline:

    def __init__(self, encoding):
        self.encoding = encoding
        self.executor = ThreadPoolExecutor(
            max_workers=1,
            thread_name_prefix="moesr-image-save",
        )
        self.pending = None

    @property
    def output_extension(self):
        return ".webp" if self.encoding["encoder"] == "webp" else ".png"

    def _encode_image(self, image):
        encoder = self.encoding["encoder"]
        level = self.encoding["level"]

        if encoder in {"png", "oxipng"}:
            png_level = level if encoder == "png" else 1
            success, encoded = cv2.imencode(
                ".png", image, [cv2.IMWRITE_PNG_COMPRESSION, png_level]
            )
            if not success:
                raise RuntimeError("Failed to encode PNG image")

            data = encoded.tobytes()
            if encoder == "oxipng":
                try:
                    import oxipng
                except ImportError as error:
                    raise RuntimeError("OxiPNG encoder is not installed") from error
                data = oxipng.optimize_from_memory(data, level=level)
            return data

        if image.ndim == 2:
            pillow_image = image
        elif image.shape[2] == 3:
            pillow_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        elif image.shape[2] == 4:
            pillow_image = cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)
        else:
            raise ValueError(f"Unsupported image channel count: {image.shape[2]}")

        height, width = image.shape[:2]
        if width > 16383 or height > 16383:
            raise ValueError("WebP width and height must not exceed 16383 pixels")

        try:
            from PIL import Image
        except ImportError as error:
            raise RuntimeError("WebP encoder is not installed") from error

        output = BytesIO()
        Image.fromarray(pillow_image).save(
            output,
            format="WEBP",
            lossless=True,
            quality=level,
            method=4,
            exact=True,
        )
        return output.getvalue()

    def _save_image(self, image, output_path):
        data = self._encode_image(image)
        temporary_path = output_path.with_name(
            f".{output_path.name}.{time.time_ns()}.tmp"
        )
        try:
            with open(temporary_path, "wb") as output_file:
                output_file.write(data)
            os.replace(temporary_path, output_path)
        finally:
            temporary_path.unlink(missing_ok=True)

    def wait(self):
        pending = self.pending
        self.pending = None
        if pending is not None:
            pending.result()

    def submit(self, image, output_path):
        self.wait()
        self.pending = self.executor.submit(
            self._save_image,
            image,
            output_path,
        )

    def shutdown(self):
        self.executor.shutdown(wait=True)


def parse_resolution_str(resolution: str, w, h):
    if "x" in resolution.lower():
        parts = resolution.lower().split("x")
        try:
            target_w = int(parts[0])
            target_h = int(h * target_w / w)
            return (target_w, target_h)
        except (ValueError, IndexError):
            logger.warning("Invalid size parameter: %s", resolution)
    elif "/" in resolution:
        parts = resolution.split("/")
        try:
            num = float(parts[0])
            den = float(parts[1])
            ratio = num / den
            target_w = int(w * ratio)
            target_h = int(h * ratio)
            return (target_w, target_h)
        except (ValueError, IndexError, ZeroDivisionError):
            logger.warning("Invalid scale parameter: %s", resolution)
