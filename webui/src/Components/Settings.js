import './Settings.css'
import TextField from '@mui/material/TextField';
import { Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';

function Settings({langSetter,webDevMode,language}) {
    const languageOptions = ['English','简体中文'];
    // 未来更多设置将改为保存按钮触发此函数
    function handleSettingsChange(webDevMode,language=null){
        let settings = {'language':language}
        if (webDevMode) {
            console.log(settings)
        }
        else{
            window.eel.py_save_settings(settings)
        }
    }
    return (
        <div className="SettingsContainer">
            <Box
            sx={{
                display:'flex',
                alignItems: 'center'
                }}>
            <Typography>Language:</Typography>
            <Autocomplete
                disablePortal
                id="language"
                options={languageOptions}
                sx={{ width:'30%',marginLeft:'10px'}}
                onChange={(event, newValue) => {
                    langSetter(newValue);
                    handleSettingsChange(webDevMode,language=newValue);
                }}
                value={language}
                renderInput={(params) => <TextField {...params} variant='standard' />}
            />
            </Box>
            
        </div>);
}

export default Settings;