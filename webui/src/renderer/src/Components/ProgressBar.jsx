import LinearProgress from '@mui/material/LinearProgress';
import { Typography, Box } from '@mui/material';

/**
 * Single progress bar for normal inference and workflow
 */
export function SingleProgressBar({ progress, progressText, totalText, isBatch, texts }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Typography sx={{ margin: '15px 0px' }}>{texts.inferProgress}</Typography>
            <LinearProgress 
                variant="determinate" 
                color='lightGreen' 
                value={progress} 
                sx={{ flexGrow: 1, top: '2px', height: '2px', margin: '0px 10px' }} 
            />
            <Box sx={{ minWidth: 150, textAlign: 'right' }}>
                <Typography sx={{ margin: '0px 0px', fontSize: isBatch ? '0.8em' : '0.96em' }}>{progressText}</Typography>
                {isBatch && <Typography sx={{ margin: '0px 0px', fontSize: '0.8em' }}>{totalText}</Typography>}
            </Box>
        </Box>
    );
}

export default { SingleProgressBar };
