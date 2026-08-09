import './Help.css'
function Help({ language }) {
    if (language === '简体中文') {
        return (
            <div className="HelpContainer">
                <strong>帮助（简体中文）</strong>
                <p>1. 使用方法</p>
                <ul>
                    <li>选择待处理图片与保存位置（待处理图片可选单张图片或者整个文件夹）</li>
                    <li>选择模型，如果有需要，展开高级设置进行更多配置</li>
                    <li>点击开始处理，等待完成</li>
                </ul>

                <p>2. 模型比较</p>
                <figure><table>
                    <thead>
                        <tr><th>模型名称</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN官方提供的动画插画模型</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>适用于日系插画，一般修复强度（去模糊，JPEG还原），保留更多细节</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>适用于日系插画，更多修复强度，少量丢失细节</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x2: universal-fix1</td><td>适用于各种风格的2d插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr></tbody>
                    <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>适用于日系插画，仅修复图片，不进行放大</td></tr>
                    <tr><td>MoeIR: MoeIRv1</td><td>高效的插画修复模型，对X，Pixiv等压缩图像有很好的修复效果</td></tr>
                </table></figure>

                <p>3. 软件设置</p>
                <ul>
                    <li>语言：切换软件界面语言</li>
                    <li>自定义文件名格式：支持占位符 {'{filestem}'}（不含后缀的原文件名）、{'{scale}'}（放大倍率）、{'{model_name}'}（模型名称）。注意：超过260字符的文件名会被自动截断</li>
                    <li>常驻显示高级设置：开启后高级设置面板始终展开</li>
                    <li>记忆常用推理选项：开启后将在成功完成推理时记录常用设置（GPU，算法对应模型，分块大小，跳过透明通道）</li>
                    <li>输出留空时保存至MoeSR_output：开启后输出留空将保存图像至输入图像文件夹下的MoeSR_output中</li>
                    <li>工作流中保持模型加载：工作流中包含多个模型时，不会从内存卸载，提高工作流运行速度，内存不足可关闭</li>
                </ul>

                <p>4. 高级设置</p>
                <figure><table>
                    <thead>
                        <tr><th>参数名</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>缩放模式</td><td>手动缩放：使用模型超分图片至大于或等于放大倍率，随后缩放至目标大小；目标分辨率：软件自动根据输入的目标分辨率自动计算合适的超分次数并缩放</td></tr>
                        <tr><td>分块大小</td><td>越大占用显存越高，但一般处理更快一些</td></tr>
                        <tr><td>跳过透明通道</td><td>勾选后，透明图片则不使用超分辨率模型处理透明通道，而采用插值处理</td></tr>
                        <tr><td>缩放为/目标尺寸</td><td>格式：长x宽；或者分数，例如1/2。输入时注意：乘号为小写半角英文x，分数为英文斜杠。最终输出的图像分辨率为该值</td></tr>
                        <tr><td>GPU</td><td>1.0.2版本后，软件支持按GPU名称选择，当无法读取GPU名称时，依旧选择ID</td></tr>
                    </tbody>
                </table></figure>
                <p>5. 工作流</p>
                    <ul>
                        <li>工作流可用于完成更多的需求，拖拽左侧节点到右侧区域即可设计你的工作流，完成后可保存，下次点击右侧上方的下拉框可选择以前保存的工作流</li>
                        <li>运行工作流后，程序会从上到下执行每个节点，跳转类节点除外</li>
                        <li>推理与调整大小节点参数与普通推理一致</li>
                        <li>标签节点用于接受跳转，填写标签名后，可被跳转节点选择</li>
                        <li>条件跳转支持使用图像长宽作为条件判断，成立与不成立可分别跳转至不同标签</li>
                        <li>跳转节点会直接跳转到指定标签</li>
                        <li>注：本功能为高级功能，程序中未设置复杂检查，请注意检查你的工作流，如往回跳转时考虑是否会造成无限循环</li>
                    </ul>
                <p>6. 常见问题</p>
                <ul>
                    <li>Error:onnxruntimeException： 可能是显存爆了，尝试调低Tile size</li>
                    <li>GPU不工作/它在集显上跑： 尝试切换GPU</li>
                    <li>Win11无法运行/其他：考虑发Issue，并附带报错信息，以及触发过程</li>
                    <li>终端显示gpu enmuerate failed.：读取GPU名称失败，不影响使用，可使用ID选择</li>
                </ul>
            </div>);
    }
    else {
        return (
            <div className="HelpContainer">
                <strong>Help (English)</strong>
                <p>1. How to Use</p>
                <ul>
                    <li>Select the image(s) to process and the output location (you can choose a single image or an entire folder).</li>
                    <li>Select a model. If needed, expand the Advanced Settings for further configuration.</li>
                    <li>Click Start and wait for the process to complete.</li>
                </ul>
                <p>2. Model Compare</p>
                <figure>
                    <table>
                        <thead>
                            <tr><th>Model name</th><th>Description</th></tr></thead>
                        <tbody>
                            <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN Official Animated Illustration Model</td></tr>
                            <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>Suitable for Japanese Style illustration, general restoration strength (de-blurring, JPEG restoration), more details retained</td></tr>
                            <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>Suitable for Japanese Style illustrations, more restoration, small amount of missing details</td></tr>
                            <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration strength</td></tr>
                            <tr><td>Real-HATGAN-x2: universal-fix1</td><td>Suitable for all styles of 2d illustration, general restoration strength</td></tr>
                            <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration of intensity</td></tr></tbody>
                        <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>Suitable for Japanese Style illustration, only fix the picture, no enlargement</td></tr>
                        <tr><td>MoeIR: MoeIRv1</td><td>Efficient illustration restoration model, with good restoration effect on compressed images such as X and Pixiv</td></tr>
                    </table>
                </figure>
                <p>3. Settings</p>
                <ul>
                    <li>Language: Switch the interface language</li>
                    <li>Custom Filename Format: Supports placeholders {'{filestem}'} (original filename (not include suffix)), {'{scale}'} (scale factor), {'{model_name}'} (model name). Note: Filenames exceeding 260 characters will be automatically truncated</li>
                    <li>Always Show Advanced Settings: When enabled, the advanced settings panel remains expanded</li>
                    <li>Remember Inference Options: When enabled, commonly used settings (GPU, algorithm corresponding model, tile size, skip alpha channel) will be recorded after a successful inference.</li>
                    <li>Output to MoeSR_output When empty: When enabled and the output field is left empty, images will be saved to the "MoeSR_output" folder inside the input image directory.</li>
                    <li>Keep Models Loaded in Workflow: When multiple models are included in a workflow, they will not be unloaded from memory, improving execution speed. Disable this option if memory is insufficient.</li>
                </ul>
                <p>4. Advanced Settings</p>
                <figure>
                    <table>
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Scaling Mode</td>
                                <td>
                                    Manual Scaling: The model upscales the image to a size greater than or equal to the scale factor, then resizes it to the target size.
                                    <br />
                                    Target Resolution: The software automatically calculates the required number of upscaling passes based on the specified target resolution and resizes accordingly.
                                </td>
                            </tr>
                            <tr>
                                <td>Tile Size</td>
                                <td>Larger values consume more GPU memory, but usually result in faster processing.</td>
                            </tr>
                            <tr>
                                <td>Skip Alpha Channel</td>
                                <td>When enabled, transparent images will not use the super-resolution model on the alpha channel; interpolation will be used instead.</td>
                            </tr>
                            <tr>
                                <td>Resize To / Target Size</td>
                                <td>
                                    Format: width x height, or a fraction such as 1/2.
                                    <br />
                                    Note: Use a lowercase English "x" for multiplication and a forward slash "/" for fractions.
                                    <br />
                                    The final output resolution will match this value.
                                </td>
                            </tr>
                            <tr>
                                <td>GPU</td>
                                <td>
                                    Starting from version 1.0.2, GPUs can be selected by name.
                                    If the GPU name cannot be detected, selection by GPU ID is still available.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </figure>
                <p>5. Workflow</p>
                    <ul>
                        <li>The workflow can be used to accomplish more advanced tasks. Drag nodes from the left panel to the right area to design your workflow. After completion, you can save it. Next time, click the dropdown menu at the top right to select a previously saved workflow.</li>
                        <li>After running the workflow, the program will execute each node from top to bottom, except for jump-type nodes.</li>
                        <li>The parameters for Inference and Resize nodes are the same as in standard inference.</li>
                        <li>The Label node is used to receive jumps. After entering a label name, it can be selected by jump nodes.</li>
                        <li>Conditional Jump supports using image width and height as the condition. If the condition is met or not met, it can jump to different labels respectively.</li>
                        <li>The Jump node will directly jump to the specified label.</li>
                        <li>Note: This is an advanced feature. The program does not include complex validation checks. Please carefully review your workflow, especially when jumping backward, to avoid potential infinite loops.</li>
                    </ul>
                <p>6. FAQ</p>
                    <ul>
                        <li>Error: onnxruntimeException: This is likely caused by insufficient GPU memory. Try reducing the tile size.</li>
                        <li>GPU not working / running on integrated graphics: Try switching to a different GPU.</li>
                        <li>Cannot run on Windows 11 / other issues: Consider opening an Issue and include error messages and reproduction steps.</li>
                        <li>Terminal shows "gpu enumerate failed": Failed to read GPU names. This does not affect functionality; you can select the GPU by ID instead.</li>
                    </ul>

            </div>);
    }
}

export default Help;