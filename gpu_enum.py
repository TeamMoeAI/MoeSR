import ctypes
from pathlib import Path


class GPUInfo(ctypes.Structure):
    _fields_ = [
        ("name", ctypes.c_wchar * 128),
        ("vendorId", ctypes.c_uint),
        ("deviceId", ctypes.c_uint)
    ]


class GPUEnum:
    def __init__(self):
        dll_path = Path(__file__).resolve().with_name('gpu_enum.dll')
        self.gpu_lib = ctypes.WinDLL(str(dll_path))
        self.max_gpus = 16
        self.gpu_array = (GPUInfo * self.max_gpus)()
        self.count = self.gpu_lib.GetGPUList(self.gpu_array, self.max_gpus)

    def gpu_dict(self):
        gpu_dict = {}
        for i in range(self.count):
            gpu_str = f"GPU {i}: {self.gpu_array[i].name}"
            gpu_dict[gpu_str] = i
        return gpu_dict

    def gpu_list(self):
        gpus = []
        for i in range(self.count):
            gpu_str = f"GPU {i}: {self.gpu_array[i].name}"
            gpus.append(gpu_str)
        return gpus


def select_better_gpu(gpu_list):
    discrete_keywords = ["nvidia", "amd", "radeon"]
    best_gpu_index = None

    for i, gpu in enumerate(gpu_list):
        gpu_lower = gpu.lower()
        if any(keyword in gpu_lower for keyword in discrete_keywords):
            best_gpu_index = i
            break

    if best_gpu_index is None:
        return gpu_list.copy()

    # 可能是独显的放前面
    best_gpu = gpu_list[best_gpu_index]
    new_list = [best_gpu] + [
        gpu for i, gpu in enumerate(gpu_list) if i != best_gpu_index
    ]

    return new_list
