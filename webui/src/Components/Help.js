import './Help.css'
function Help({language}) {
    if (language === '简体中文'){
        return (
            <div className="HelpContainer">
                <strong>帮助（简体中文）</strong>
                <p>1. 模型比较</p>
                <p>由于需要时间训练与测试模型，模型发布会晚于软件本体发布，选项中缺少下方模型是正常的。</p>
                <figure><table>
                    <thead>
                        <tr><th>模型名称</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN官方提供的动画插画模型</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>适用于日系插画，一般修复强度（去模糊，JPEG还原），保留更多细节</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>适用于日系插画，更多修复强度，少量丢失细节</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1-v2</td><td>适用于日系插画，一般修复强度，GAN失真有略微改善</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix2</td><td>适用于日系插画，更多的修复，少量丢失细节</td></tr>
                        <tr><td>Real-HATGAN-x2: universal-fix1</td><td>适用于各种风格的2d插画，一般修复强度</td></tr>
                        <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>适用于日系插画，一般修复强度</td></tr></tbody>
                        <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>适用于日系插画，仅修复图片，不进行放大</td></tr>
                </table></figure>
                <p>2. 模型参数</p>
                <figure><table>
                    <thead>
                        <tr><th>参数名</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>模型</td><td>选择你需要的模型</td></tr>
                        <tr><td>分块大小</td><td>越大占用显存越高，但处理更快一些</td></tr>
                        <tr><td>放大倍率</td><td>需要放大的倍数，除仅修复模型外，如果该值与模型放大倍数不同，小于模型倍数则图片将会被缩放，大于模型倍数则图片会被重复超分辨率处理并缩放到目标倍数</td></tr>
                        <tr><td>跳过透明通道</td><td>勾选后，透明图片则不使用超分辨率模型处理透明通道，而采用插值处理</td></tr>
                        <tr><td>缩放为</td><td>缩放图片到指定尺寸。格式：长x宽；或者分数，例如1/2。输入时注意：乘号为小写半角英文x，分数为英文斜杠。（如果同时指定缩放倍率与该值，缩放倍率导致的超分次数不变，但最终图片尺寸会被缩放为该值）</td></tr>
                    </tbody>
                </table></figure>
                <p>3. 处理参数</p>
                <figure><table>
                    <thead>
                        <tr><th>参数名</th><th>描述</th></tr></thead>
                    <tbody>
                        <tr><td>待处理图片（文件夹）</td><td>待进行超分辨率的图片(文件夹)，点击旁边“选择”按钮选择，仅支持jpg/png</td></tr>
                        <tr><td>保存位置</td><td>保存图片的位置</td></tr>
                        <tr><td>处理进度</td><td>单张图片进度。未来会加上剩余时间与总进度</td></tr>
                        <tr><td>批量处理</td><td>批处理，勾选后可以选择整个文件夹作为输入</td></tr>
                        <tr><td>GPU</td><td>GPU ID。由于onnx官方未提供获取id与名称的对应，暂时只能手动指定。</td></tr>
                    </tbody>
                </table></figure>
                <p>4. 常见问题</p>
                <ul>
                    <li>Error:onnxruntimeException： 可能是显存爆了，尝试调低Tile size</li>
                    <li>GPU不工作/它在集显上跑： 尝试切换GPU ID</li>
                    <li>Win11无法运行/其他：考虑发Issue，并附带报错信息，以及触发过程</li>
                </ul>
            </div>);
    }
    else{
        return (
            <div className="HelpContainer">
                <strong>Help (English)</strong>
                <p>1. Model Compare</p>
                <p>Due to the time required for training and testing models, the model release may be later than the software release, so it is normal for the model options to be missing below.</p>
                <figure>
                <table>
                <thead>
                        <tr><th>Model name</th><th>Description</th></tr></thead>
                    <tbody>
                        <tr><td>Real-ESRGAN-x4: Anime6B-Official</td><td>RealESRGAN Official Animated Illustration Model</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix1-d</td><td>Suitable for Japanese Style illustration, general restoration strength (de-blurring, JPEG restoration), more details retained</td></tr>
                        <tr><td>Real-ESRGAN-x4: jp_Illustration-fix2</td><td>Suitable for Japanese Style illustrations, more restoration, small amount of missing details</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration strength</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix1-v2</td><td>Suitable for Japanese Style illustrations, general restoration strength, slightly reduced GAN artifact</td></tr>
                        <tr><td>Real-HATGAN-x4: jp_Illustration-fix2</td><td>Suitable for Japanese Style illustrations, more restoration, small amount of missing details</td></tr>
                        <tr><td>Real-HATGAN-x2: universal-fix1</td><td>Suitable for all styles of 2d illustration, general restoration strength</td></tr>
                        <tr><td>Real-HATGAN-x2: jp_Illustration-fix1</td><td>Suitable for Japanese Style illustrations, general restoration of intensity</td></tr></tbody>
                        <tr><td>Real-HATGAN-x1: jp_Illustration-fixonly</td><td>Suitable for Japanese Style illustration, only fix the picture, no enlargement</td></tr>
                </table>
                </figure>
                <p>2. Model Config</p>
                <figure><table>
                    <thead>
                        <tr><th>Parameter name</th><th>Description</th></tr></thead>
                    <tbody>
                        <tr><td>Model</td><td>Select your desired model</td></tr>
                        <tr><td>Tile Size</td><td>Tile size, the bigger the size, the higher the GPU RAM consumption, but the faster the processing</td></tr>
                        <tr><td>Scale</td><td>The scaling factor needed, apart from the models that only support restoration, will determine how the image is processed. If the scaling factor is different from the model's scaling factor, the image will be resized if it is smaller than the model's scaling factor, or it will undergo repeated super-resolution processing and then be resized to the target scaling factor if it is larger.</td></tr>
                        <tr><td>Skip Alpha</td><td>When checked, RGBA images will not be processed by the super-resolution model for Alpha channel, but by interpolation.</td></tr>
                        <tr><td>Resize To</td><td>Scale the image to the specified size. Format: widthxheight; or fraction, like the default options in the input box. If both the scaling factor and this value are specified, the image will be scaled to this value first.</td></tr>
                    </tbody>
                </table></figure>
                <p>3. Process Config</p>
                <figure><table>
                    <thead>
                        <tr><th>Parameter name</th><th>Description</th></tr></thead>
                    <tbody>
                        <tr><td>Input Image(Folder)</td><td>The image (folder) to be super resolution, click the "Select" button next to it to select it, only jpg/png is supported</td></tr>
                        <tr><td>Save To</td><td>Where to save the image</td></tr>
                        <tr><td>Progress</td><td>Progress of single image. The remaining time and total progress will be added in the future</td></tr>
                        <tr><td>Batch Process</td><td>Batch process, check to select whole folder as input</td></tr>
                        <tr><td>GPU</td><td>GPU ID. Since onnx doesn't provide a mapping to get the id and name, you have to specify it manually for now. </td></tr>
                    </tbody>
                </table></figure>
            </div>);
    }
}

export default Help;