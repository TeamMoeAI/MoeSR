import './InferenceUI.css'
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import LoadingButton from '@mui/lab/LoadingButton';
function ProgressTextDisplay({ singleProgressText, totalProgressText, isBatchProcess }) {
    if (isBatchProcess) {
        return (
            <Box>
                <Typography sx={{ margin: '0px 0px', fontSize: '0.8em' }}>{singleProgressText}</Typography>
                <Typography sx={{ margin: '0px 0px', fontSize: '0.8em' }}>{totalProgressText}</Typography>
            </Box>
        )
    }
    else {
        return (
            <Typography sx={{ margin: '0px 0px', fontSize: '0.96em' }}>{singleProgressText}</Typography>
        )
    }
}

async function getModelList(algoName, webDevMode) {
    if (webDevMode) {
        // for dev
        let dummyData;
        if (algoName === "real-esrgan") {
            dummyData = ["esrgan model1", "x4_jp_Illustration-fix1-d", "x2_jp_Illustration-fix1-d"]
        }
        else if (algoName === "real-hatgan") {
            dummyData = ["hatgan model1", "model2", "model3"]
        }
        return dummyData
    }
    else {
        return await window.eel.py_get_model_list(algoName)()
    }
}
function InferenceUI({ algoName, webDevMode, texts }) {

    // AlgoName : real-esrgan or real-hatgan
    var algoTitle;
    if (algoName === "real-esrgan") {
        algoTitle = <h3><strong>R</strong>eal-<strong>ESR</strong>GAN</h3>
    }
    else if (algoName === "real-hatgan") {
        algoTitle = <h3><strong>R</strong>eal-<strong>HAT</strong>GAN</h3>
    }
    // process state Alert
    let stateAlert;
    const [processState, setProcessState] = useState("idle");

    function handleSetProcessState(state) {
        setProcessState(state)
        if (state === 'finish') {
            setInfering(false)
        }
    }
    function handleAlertClose() {
        setProcessState('idle')
    }

    if (processState === "finish") {
        stateAlert = <Alert severity="success" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertFinish}</Alert>;
    }
    else if (processState === "error") {
        stateAlert = <Alert severity="error" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertError}</Alert>;
    }
    else if (processState === "idle") {
        stateAlert = <></>
    }
    else if (processState === "missing param") {
        stateAlert = <Alert severity="info" onClose={() => { handleAlertClose() }}
        >{texts.inferAlertMissingParam}</Alert>;
    }
    function checkInput(modelName, inputImage, outputPath) {
        if (!modelName || !inputImage || !outputPath) {
            setInfering(false);
            setProcessState('missing param');
            return false
        }
        else {
            return true
        }
    }

    function runProcess(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID) {
        if (webDevMode) {
            // for dev
            console.log(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID)
        }
        else {
            if (checkInput(modelName, inputImage, outputPath)) {
                window.eel.py_run_process(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID,algoName)
            }
        }
    }
    // Options
    const [modelOptions, setModelOptions] = useState([])
    // Infer Config
    const [modelName, setModelName] = useState(null);
    const [tileSize, setTileSize] = useState(64);
    const [scale, setScale] = useState(4);
    const [isSkipAlpha, setIsSkipAlpha] = useState(false);
    const [resizeTo, setResizeTo] = useState(null);
    // Process Config
    // input type: Image or Folder
    const [inputType, setInputType] = useState('Image');
    const [isBatchProcess, setIsBatchProcess] = useState(false);
    const [inputImage, setInputImage] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [progress, setProgress] = useState(0);
    const [singleProgressText, setSingleProgressText] = useState('0% ETR:--:--:--');
    const [totalProgressText, setTotalProgressText] = useState('0% ETR:--:--:--');
    const [GPUID, setGPUID] = useState(0);
    const [infering, setInfering] = useState(false);
    let inputText = texts.inferInputImage;
    if (inputType === 'Folder') {
        inputText = texts.inferInputFolder;
    }
    // Backend communication
    useEffect(() => {
        // Runs ONCE after initial rendering
        getModelList(algoName, webDevMode).then(result => { setModelOptions(result) })
        console.log('Effect run ' + algoName)
    }, [algoName, webDevMode]);
    if (!webDevMode) {
        window.eel.expose(handleSetProgress, 'handleSetProgress');
        window.eel.expose(handleSetProcessState, 'handleSetProcessState');
        window.eel.expose(showError, 'showError');
    }
    function showError(errorText) {
        window.electronAPI.showError(errorText);
        setProcessState('idle');
    }
    function handleSetProgress(progressNum, singleProgressText, totalProgressText) {
        setProgress(progressNum);
        setSingleProgressText(singleProgressText);
        setTotalProgressText(totalProgressText)
    }
    async function handleInputSelect() {
        let input;
        if (isBatchProcess) {
            setInputImage(await window.electronAPI.openFolder());
        }
        else {
            setInputImage(await window.electronAPI.openFile());
        }
        input = document.getElementById('input-image');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    async function handleOutputSelect() {
        let input;
        setOutputPath(await window.electronAPI.openFolder());
        input = document.getElementById('output-path');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    function handelBatchProcessChange(event) {
        setIsBatchProcess(event.target.checked)
        if (event.target.checked) {
            setInputType('Folder');
        }
        else {
            setInputType('Image');
        }
        // Avoid ordering Fried Rice
        setInputImage('');
    }
    function handelSetModelName(modelName) {
        setModelName(modelName);
        // Automatically synchronize Scale based on model name
        const match = modelName.match(/x(\d+)_/);

        if (match) {
            const numberStr = match[1];
            const number = parseInt(numberStr);
            setScale(number)
        }
    }
    return (
        <div className='InferUI'>
            {algoTitle}
            <div className="ConfigureArea">
                <div className="ModelConfig">
                    <h4>{texts.inferModelConfig}</h4>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferModel}</Typography>
                        <Autocomplete
                            disablePortal
                            id="modelFile"
                            options={modelOptions}
                            sx={{ flexGrow: 1 }}
                            onChange={(event, newValue) => {
                                handelSetModelName(newValue);
                            }}
                            renderInput={(params) => <TextField {...params} variant='standard' />}
                        />
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'

                        }}>
                        <Typography sx={{ margin: '15px 0px', marginRight: '2%' }}>{texts.inferTileSize}</Typography>
                        <Slider size='small' aria-label="Small" defaultValue={64}
                            valueLabelDisplay="auto" step={64} min={64} max={640} color='lightBlue'
                            onChange={(event, newValue) => { setTileSize(newValue) }}
                        />
                        <Typography sx={{ margin: '15px 10px', width: '8%' }}>{tileSize}</Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                        <Typography sx={{ margin: '15px 0px', marginRight: '2%' }}>{texts.inferScale}</Typography>
                        <Slider size='small' aria-label="Small" defaultValue={4}
                            valueLabelDisplay="auto" step={1} min={1} max={16} color='lightBlue'
                            // sx={{ flexGrow: 0.5 }} 
                            onChange={(event, newValue) => { setScale(newValue) }}
                        />
                        <Typography sx={{ margin: '15px 10px', width: '8%' }}>{scale}</Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                            <Typography sx={{ margin: '15px 0px' }}>{texts.inferSkipAlpha}</Typography>
                            <Checkbox size="small" sx={{ top: '1px' }} onChange={(event) => { setIsSkipAlpha(event.target.checked) }} />
                            {/* <Typography sx={{ margin: '15px 0px' }}>{isFP32+""}</Typography> */}
                        </Box>

                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferResizeTo}</Typography>
                        <Autocomplete
                            disablePortal
                            freeSolo
                            id="modelFile"
                            options={['1920x1080', '1280x720', '1/2']}
                            sx={{ flexGrow: 1 }}
                            onInputChange={(event, value, reason) => { setResizeTo(value) }}
                            onChange={(event, value) => { setResizeTo(value) }}
                            renderInput={(params) => <TextField {...params} variant='standard' />}
                        />
                    </Box>


                    {/* <TextField id="standard-basic" label="Height" variant="standard" disabled={true} /> */}
                </div>
                <div className="Processor">
                    <h4>{texts.inferProcessImage}</h4>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'

                        }}>
                        {/* <p>Input Image:</p> */}
                        <Typography sx={{ margin: '15px 0px' }}>{inputText}</Typography>
                        <TextField id="input-image" variant="standard" sx={{ margin: '10px 5px', flexGrow: 1 }}
                            value={inputImage} />
                        <Button variant="outlined" sx={{ width: '15%' }}
                            onClick={handleInputSelect}
                        >{texts.inferSelectButton}</Button>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'

                        }}>
                        {/* <p>Save To:</p> */}
                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferSaveTo}</Typography>
                        <TextField id="output-path" variant="standard" sx={{ margin: '10px 5px', flexGrow: 1 }} value={outputPath} />
                        <Button variant="outlined" sx={{ width: '15%' }} onClick={handleOutputSelect}>{texts.inferSelectButton}</Button>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'

                        }}>
                        {/* <p>Progress:</p> */}
                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferProgress}</Typography>
                        <LinearProgress variant="determinate" color='lightGreen' value={progress} sx={{ flexGrow: 1, top: '2px', height: '2px', margin: '0px 10px' }} />
                        {/* <p>50%</p> */}
                        <ProgressTextDisplay
                            singleProgressText={singleProgressText}
                            totalProgressText={totalProgressText}
                            isBatchProcess={isBatchProcess}
                        ></ProgressTextDisplay>

                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'

                        }}>

                        <Typography sx={{ margin: '15px 0px' }}>{texts.inferBatchProcess}</Typography>
                        <Checkbox size="small" sx={{ top: '1px', width: '10px', right: '3px' }}
                            onChange={(event) => { handelBatchProcessChange(event) }} />
                        <Typography sx={{ margin: '15px 0px' }}>GPU:</Typography>
                        <TextField id="standard-number" type="number" variant="standard" sx={{ width: '10%' }} onChange={(event) => { setGPUID(event.target.value) }} value={GPUID} />
                        <LoadingButton variant="outlined" color='lightPink'
                            sx={{ width: '15%', flexGrow: 1, marginLeft: '2%' }}
                            loading={infering}
                            startIcon={<></>}
                            loadingPosition="start"
                            onClick={() => { handleAlertClose(); setInfering(true); runProcess(modelName, tileSize, scale, isSkipAlpha, resizeTo, inputType, inputImage, outputPath, GPUID) }}
                        >{texts.inferStartButton}</LoadingButton>
                    </Box>
                    {stateAlert}
                    <div className="Version">
                        MoeSR Release 1.0.0
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InferenceUI;