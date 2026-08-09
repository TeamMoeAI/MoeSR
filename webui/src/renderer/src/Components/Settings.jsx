import './Settings.css'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import { Typography } from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    getContextMenuStatus,
    getSettings,
    getWorkflowList,
    registerContextMenu,
    saveSettings,
    unregisterContextMenu,
} from '../api/backend-api'

const DEFAULT_FILENAME_FORMAT = '{filestem}_MoeSR_x{scale}_{model_name}.png'

function Settings({ langSetter, webDevMode, language, alwaysShowAdvanced, setAlwaysShowAdvanced, rememberOptions, setRememberOptions, defaultOutputPath, setDefaultOutputPath, workflowKeepModels, setWorkflowKeepModels, texts }) {
    const languageOptions = ['English', '简体中文']
    const [customFilenameFormat, setCustomFilenameFormat] = useState(DEFAULT_FILENAME_FORMAT)
    const [localLanguage, setLocalLanguage] = useState(language)
    const [localAlwaysShowAdvanced, setLocalAlwaysShowAdvanced] = useState(alwaysShowAdvanced)
    const [localRememberOptions, setLocalRememberOptions] = useState(rememberOptions)
    const [localDefaultOutputPath, setLocalDefaultOutputPath] = useState(defaultOutputPath)
    const [localWorkflowKeepModels, setLocalWorkflowKeepModels] = useState(workflowKeepModels)
    const [imageEncoder, setImageEncoder] = useState('png')
    const [pngCompressionLevel, setPngCompressionLevel] = useState(1)
    const [oxipngCompressionLevel, setOxipngCompressionLevel] = useState(2)
    const [webpCompressionLevel, setWebpCompressionLevel] = useState(80)
    const [quickWorkflowName, setQuickWorkflowName] = useState('')
    const [workflowOptions, setWorkflowOptions] = useState([])
    const [contextMenuStatus, setContextMenuStatus] = useState({ supported: false, registered: false })
    const [contextMenuBusy, setContextMenuBusy] = useState(false)
    const [contextMenuError, setContextMenuError] = useState('')
    const [loadedSettings, setLoadedSettings] = useState({})
    const [savedFormState, setSavedFormState] = useState(null)
    const [filenameError, setFilenameError] = useState('')
    const filenameInputRef = useRef(null)

    const illegalChars = /[\\/:*?"<>|]/

    useEffect(() => {
        if (webDevMode) {
            setSavedFormState({
                language,
                alwaysShowAdvanced,
                customFilenameFormat: DEFAULT_FILENAME_FORMAT,
                rememberOptions,
                defaultOutputPath,
                workflowKeepModels,
                imageEncoder: 'png',
                pngCompressionLevel: 1,
                oxipngCompressionLevel: 2,
                webpCompressionLevel: 80,
                quickWorkflowName: '',
            })
            return
        }

        Promise.all([getSettings(), getWorkflowList(), getContextMenuStatus()])
            .then(([settings, workflows, menuStatus]) => {
                const nextFormState = {
                    language: settings.language || language,
                    alwaysShowAdvanced: settings.alwaysShowAdvanced ?? alwaysShowAdvanced,
                    customFilenameFormat: settings.customFilenameFormat || DEFAULT_FILENAME_FORMAT,
                    rememberOptions: settings.rememberOptions ?? rememberOptions,
                    defaultOutputPath: settings.defaultOutputPath ?? defaultOutputPath,
                    workflowKeepModels: settings.workflowKeepModels ?? workflowKeepModels,
                    imageEncoder: settings.imageEncoder || 'png',
                    pngCompressionLevel: settings.pngCompressionLevel ?? 1,
                    oxipngCompressionLevel: settings.oxipngCompressionLevel ?? 2,
                    webpCompressionLevel: settings.webpCompressionLevel ?? 80,
                    quickWorkflowName: settings.quickWorkflowName || '',
                }

                setLoadedSettings(settings)
                setLocalLanguage(nextFormState.language)
                setLocalAlwaysShowAdvanced(nextFormState.alwaysShowAdvanced)
                setCustomFilenameFormat(nextFormState.customFilenameFormat)
                setLocalRememberOptions(nextFormState.rememberOptions)
                setLocalDefaultOutputPath(nextFormState.defaultOutputPath)
                setLocalWorkflowKeepModels(nextFormState.workflowKeepModels)
                setImageEncoder(nextFormState.imageEncoder)
                setPngCompressionLevel(nextFormState.pngCompressionLevel)
                setOxipngCompressionLevel(nextFormState.oxipngCompressionLevel)
                setWebpCompressionLevel(nextFormState.webpCompressionLevel)
                setQuickWorkflowName(nextFormState.quickWorkflowName)
                setWorkflowOptions(workflows)
                setContextMenuStatus(menuStatus)
                setSavedFormState(nextFormState)
            })
            .catch(error => {
                setContextMenuError(error instanceof Error ? error.message : String(error))
            })
    }, [webDevMode]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setLocalLanguage(language)
    }, [language])

    useEffect(() => {
        setLocalAlwaysShowAdvanced(alwaysShowAdvanced)
    }, [alwaysShowAdvanced])

    useEffect(() => {
        setLocalRememberOptions(rememberOptions)
    }, [rememberOptions])

    useEffect(() => {
        setLocalDefaultOutputPath(defaultOutputPath)
    }, [defaultOutputPath])

    useEffect(() => {
        setLocalWorkflowKeepModels(workflowKeepModels)
    }, [workflowKeepModels])

    const validateFilename = (filename) => {
        const withoutPlaceholders = filename
            .replace(/{filestem}/g, '')
            .replace(/{scale}/g, '')
            .replace(/{model_name}/g, '')

        if (illegalChars.test(withoutPlaceholders)) {
            setFilenameError(texts.settingsFilenameError)
            return false
        }
        setFilenameError('')
        return true
    }

    const currentFormState = useMemo(() => ({
        language: localLanguage,
        alwaysShowAdvanced: localAlwaysShowAdvanced,
        customFilenameFormat,
        rememberOptions: localRememberOptions,
        defaultOutputPath: localDefaultOutputPath,
        workflowKeepModels: localWorkflowKeepModels,
        imageEncoder,
        pngCompressionLevel,
        oxipngCompressionLevel,
        webpCompressionLevel,
        quickWorkflowName,
    }), [
        localLanguage,
        localAlwaysShowAdvanced,
        customFilenameFormat,
        localRememberOptions,
        localDefaultOutputPath,
        localWorkflowKeepModels,
        imageEncoder,
        pngCompressionLevel,
        oxipngCompressionLevel,
        webpCompressionLevel,
        quickWorkflowName,
    ])

    const hasUnsavedChanges = savedFormState !== null && Object.keys(currentFormState)
        .some(key => currentFormState[key] !== savedFormState[key])

    const buildSettings = () => ({
        ...loadedSettings,
        ...currentFormState,
    })

    const handleSaveSettings = async () => {
        if (!validateFilename(customFilenameFormat)) return

        if (localLanguage !== language) langSetter(localLanguage)
        if (localAlwaysShowAdvanced !== alwaysShowAdvanced) setAlwaysShowAdvanced(localAlwaysShowAdvanced)
        if (localRememberOptions !== rememberOptions) setRememberOptions(localRememberOptions)
        if (localDefaultOutputPath !== defaultOutputPath) setDefaultOutputPath(localDefaultOutputPath)
        if (localWorkflowKeepModels !== workflowKeepModels) setWorkflowKeepModels(localWorkflowKeepModels)

        const settings = buildSettings()
        if (webDevMode) {
            console.log(settings)
            setLoadedSettings(settings)
            setSavedFormState(currentFormState)
            return
        }

        const result = await saveSettings(settings)
        if (result === 0) {
            setLoadedSettings(settings)
            setSavedFormState(currentFormState)
        }
    }

    const handleRegisterContextMenu = async () => {
        if (!quickWorkflowName || contextMenuBusy) return
        setContextMenuBusy(true)
        setContextMenuError('')
        try {
            const settings = { ...loadedSettings, quickWorkflowName }
            const saveResult = await saveSettings(settings)
            if (saveResult !== 0) throw new Error(texts.settingsSaveError)
            setLoadedSettings(settings)
            setSavedFormState(previous => previous ? { ...previous, quickWorkflowName } : currentFormState)
            setContextMenuStatus(await registerContextMenu())
        } catch (error) {
            setContextMenuError(error instanceof Error ? error.message : String(error))
        } finally {
            setContextMenuBusy(false)
        }
    }

    const handleUnregisterContextMenu = async () => {
        if (contextMenuBusy) return
        setContextMenuBusy(true)
        setContextMenuError('')
        try {
            setContextMenuStatus(await unregisterContextMenu())
        } catch (error) {
            setContextMenuError(error instanceof Error ? error.message : String(error))
        } finally {
            setContextMenuBusy(false)
        }
    }

    const insertPlaceholder = (placeholder) => {
        const input = filenameInputRef.current?.querySelector('input')
        if (!input) return

        const start = input.selectionStart
        const end = input.selectionEnd
        const newValue = customFilenameFormat.substring(0, start) + placeholder + customFilenameFormat.substring(end)
        setCustomFilenameFormat(newValue)
        validateFilename(newValue)
        setTimeout(() => {
            input.focus()
            input.setSelectionRange(start + placeholder.length, start + placeholder.length)
        }, 0)
    }

    const resetToDefault = () => {
        setCustomFilenameFormat(DEFAULT_FILENAME_FORMAT)
        setFilenameError('')
    }

    const setSameAsInput = () => {
        setCustomFilenameFormat('{filestem}.png')
        setFilenameError('')
    }

    const encoderLevel = {
        png: {
            value: pngCompressionLevel,
            min: 0,
            max: 9,
            setter: setPngCompressionLevel,
        },
        oxipng: {
            value: oxipngCompressionLevel,
            min: 0,
            max: 6,
            setter: setOxipngCompressionLevel,
        },
        webp: {
            value: webpCompressionLevel,
            min: 0,
            max: 100,
            setter: setWebpCompressionLevel,
        },
    }[imageEncoder]

    const contextMenuText = !contextMenuStatus.supported
        ? texts.settingsContextMenuUnavailable
        : contextMenuStatus.registered
            ? texts.settingsContextMenuRegistered
            : texts.settingsContextMenuNotRegistered

    return (
        <div className="SettingsContainer">
            <div className="SettingsContent">
                <section className="SettingsSection" aria-labelledby="settings-general-title">
                    <Typography component="h2" id="settings-general-title" className="SettingsSectionTitle">
                        {texts.settingsGeneral}
                    </Typography>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsLanguage}</Typography>
                        <Autocomplete
                            disablePortal
                            id="language"
                            options={languageOptions}
                            value={localLanguage}
                            onChange={(_event, newValue) => setLocalLanguage(newValue || language)}
                            className="SettingsMediumControl"
                            renderInput={(params) => <TextField {...params} variant="standard" size="small" />}
                        />
                    </Box>

                    <Box className="SettingsRow SettingsSwitchRow">
                        <Typography className="SettingsLabel">{texts.settingsAlwaysShowAdvanced}</Typography>
                        <Switch
                            size="small"
                            checked={localAlwaysShowAdvanced}
                            onChange={(event) => setLocalAlwaysShowAdvanced(event.target.checked)}
                            inputProps={{ 'aria-label': texts.settingsAlwaysShowAdvanced }}
                        />
                    </Box>

                    <Box className="SettingsRow SettingsSwitchRow">
                        <Typography className="SettingsLabel">{texts.settingsRememberOptions}</Typography>
                        <Switch
                            size="small"
                            checked={localRememberOptions}
                            onChange={(event) => setLocalRememberOptions(event.target.checked)}
                            inputProps={{ 'aria-label': texts.settingsRememberOptions }}
                        />
                    </Box>
                </section>

                <section className="SettingsSection" aria-labelledby="settings-output-title">
                    <Typography component="h2" id="settings-output-title" className="SettingsSectionTitle">
                        {texts.settingsOutputEncoding}
                    </Typography>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsCustomFilename}</Typography>
                        <TextField
                            ref={filenameInputRef}
                            variant="standard"
                            size="small"
                            value={customFilenameFormat}
                            onChange={(event) => {
                                setCustomFilenameFormat(event.target.value)
                                validateFilename(event.target.value)
                            }}
                            error={!!filenameError}
                            helperText={filenameError}
                            className="SettingsWideControl"
                            inputProps={{ 'aria-label': texts.settingsCustomFilename }}
                        />
                    </Box>

                    <Box className="SettingsActionsRow">
                        <Button variant="outlined" size="small" onClick={() => insertPlaceholder('{filestem}')}>
                            {texts.settingsInsertFilestem}
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => insertPlaceholder('{scale}')}>
                            {texts.settingsInsertScale}
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => insertPlaceholder('{model_name}')}>
                            {texts.settingsInsertModelName}
                        </Button>
                        <Button variant="text" size="small" onClick={resetToDefault}>
                            {texts.settingsResetDefault}
                        </Button>
                        <Button variant="text" size="small" onClick={setSameAsInput}>
                            {texts.settingsSameAsInput}
                        </Button>
                    </Box>

                    <Box className="SettingsRow SettingsSwitchRow">
                        <Typography className="SettingsLabel">{texts.settingsDefaultOutputPath}</Typography>
                        <Switch
                            size="small"
                            checked={localDefaultOutputPath}
                            onChange={(event) => setLocalDefaultOutputPath(event.target.checked)}
                            inputProps={{ 'aria-label': texts.settingsDefaultOutputPath }}
                        />
                    </Box>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsImageEncoder}</Typography>
                        <TextField
                            select
                            variant="standard"
                            size="small"
                            value={imageEncoder}
                            onChange={(event) => setImageEncoder(event.target.value)}
                            className="SettingsEncoderControl"
                            inputProps={{ 'aria-label': texts.settingsImageEncoder }}
                        >
                            <MenuItem value="png">PNG</MenuItem>
                            <MenuItem value="oxipng">OxiPNG</MenuItem>
                            <MenuItem value="webp">WebP</MenuItem>
                        </TextField>
                    </Box>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsCompressionLevel}</Typography>
                        <Slider
                            size="small"
                            aria-label={texts.settingsCompressionLevel}
                            value={encoderLevel.value}
                            min={encoderLevel.min}
                            max={encoderLevel.max}
                            step={1}
                            valueLabelDisplay="auto"
                            color="lightBlue"
                            onChange={(_event, value) => encoderLevel.setter(Number(value))}
                            className="SettingsCompressionSlider"
                        />
                    </Box>
                </section>

                <section className="SettingsSection" aria-labelledby="settings-workflow-title">
                    <Typography component="h2" id="settings-workflow-title" className="SettingsSectionTitle">
                        {texts.settingsWorkflowIntegration}
                    </Typography>

                    <Box className="SettingsRow SettingsSwitchRow">
                        <Typography className="SettingsLabel">{texts.settingsWorkflowKeepModels}</Typography>
                        <Switch
                            size="small"
                            checked={localWorkflowKeepModels}
                            onChange={(event) => setLocalWorkflowKeepModels(event.target.checked)}
                            inputProps={{ 'aria-label': texts.settingsWorkflowKeepModels }}
                        />
                    </Box>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsQuickWorkflow}</Typography>
                        <Autocomplete
                            disablePortal
                            options={workflowOptions}
                            value={workflowOptions.includes(quickWorkflowName) ? quickWorkflowName : null}
                            onChange={(_event, newValue) => setQuickWorkflowName(newValue || '')}
                            className="SettingsMediumControl"
                            renderInput={(params) => <TextField {...params} variant="standard" size="small" />}
                        />
                    </Box>

                    <Box className="SettingsRow">
                        <Typography className="SettingsLabel">{texts.settingsContextMenuStatus}</Typography>
                        <Box className="SettingsContextMenuControl">
                            <Typography className={contextMenuStatus.registered ? 'SettingsStatus SettingsStatusRegistered' : 'SettingsStatus'}>
                                {contextMenuText}
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={contextMenuStatus.registered ? handleUnregisterContextMenu : handleRegisterContextMenu}
                                disabled={!contextMenuStatus.supported || (!contextMenuStatus.registered && !quickWorkflowName) || contextMenuBusy}
                            >
                                {contextMenuStatus.registered
                                    ? texts.settingsUnregisterContextMenu
                                    : texts.settingsRegisterContextMenu}
                            </Button>
                        </Box>
                    </Box>

                    {contextMenuError && (
                        <Typography className="SettingsError" role="alert">{contextMenuError}</Typography>
                    )}
                </section>
            </div>

            <Box className="SettingsSaveBar">
                <Typography className="SettingsUnsavedMessage" aria-live="polite">
                    {hasUnsavedChanges ? texts.settingsUnsaved : ''}
                </Typography>
                <Button
                    variant="outlined"
                    color="lightPink"
                    onClick={handleSaveSettings}
                    disabled={!!filenameError}
                >
                    {texts.settingsSaveButton}
                </Button>
            </Box>
        </div>
    )
}

export default Settings
