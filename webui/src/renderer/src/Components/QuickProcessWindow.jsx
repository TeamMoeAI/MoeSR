import './QuickProcessWindow.css';
import { Box, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import BackGround from './Background';
import { SingleProgressBar } from './ProgressBar';
import translations from '../Language';
import { getQuickState, onQuickStateChange } from '../api/backend-api';

const initialState = {
    status: 'starting',
    sourcePath: '',
    workflowName: '',
    outputPath: '',
    progress: 0,
    progressText: '',
    totalProgressText: '',
    error: '',
    queueLength: 0,
    language: 'English',
};

function QuickProcessWindow() {
    const [state, setState] = useState(initialState);

    useEffect(() => {
        getQuickState().then(setState);
        return onQuickStateChange(setState);
    }, []);

    const texts = translations[state.language === '简体中文' ? 'zh' : 'en'];
    const statusText = useMemo(() => ({
        idle: texts.quickStarting,
        preview: texts.quickPreview,
        starting: texts.quickStarting,
        queued: texts.quickQueued,
        running: texts.quickRunning,
        finish: texts.quickFinished,
        error: texts.quickError,
    })[state.status] || texts.quickStarting, [state.status, texts]);

    return (
        <div className="QuickProcessWindow">
            <BackGround />
            <Box className="QuickProcessContent">
                <Typography className="QuickProcessTitle">{texts.quickTitle}</Typography>
                <Typography className={`QuickProcessStatus status-${state.status}`}>{statusText}</Typography>

                <div className="QuickProcessDetails">
                    <div><span>{texts.quickSource}</span><strong title={state.sourcePath}>{state.sourcePath || '-'}</strong></div>
                    <div><span>{texts.quickWorkflow}</span><strong>{state.workflowName || '-'}</strong></div>
                    <div><span>{texts.quickOutput}</span><strong title={state.outputPath}>{state.outputPath || '-'}</strong></div>
                </div>

                <SingleProgressBar
                    progress={state.progress}
                    progressText={state.progressText || `${state.progress}%`}
                    totalText={state.totalProgressText}
                    isBatch={Boolean(state.totalProgressText)}
                    texts={texts}
                />

                {state.error && <Typography className="QuickProcessError">{state.error}</Typography>}
            </Box>
        </div>
    );
}

export default QuickProcessWindow;
