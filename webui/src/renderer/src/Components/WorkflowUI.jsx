import './WorkflowUI.css'
import { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InputAdornment from '@mui/material/InputAdornment';
import { Typography } from '@mui/material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import Alert from '@mui/material/Alert';
import { SingleProgressBar } from './ProgressBar';
import {
    expose,
    getAllModels,
    getGpuList,
    getWorkflowList,
    loadWorkflow as loadBackendWorkflow,
    openFileOrFolder,
    runWorkflow as runBackendWorkflow,
    saveWorkflow as saveBackendWorkflow,
    showErrorDialog,
} from '../api/backend-api';

const NODE_TYPES = {
    inference: 'inference',
    scale: 'scale',
    conditional_jump: 'conditional_jump',
    jump: 'jump',
    label: 'label'
};

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getDefaultConfig = (type) => {
    switch (type) {
        case NODE_TYPES.inference:
            return { algoName: '', modelName: '', tileSize: 64, gpuId: '0', skipAlpha: false };
        case NODE_TYPES.scale:
            return { value: '' };
        case NODE_TYPES.conditional_jump:
            return { conditionType: 'width', operator: 'gt', value: 1920, trueJumpTo: '', falseJumpTo: '' };
        case NODE_TYPES.jump:
            return { jumpTo: '' };
        case NODE_TYPES.label:
            return { name: '' };
        default:
            return {};
    }
};

function NodeHeader({ title, summary, collapsed, onToggle, onDelete }) {
    return (
        <div className="NodeHeader" onClick={onToggle}>
            <div className="NodeHeaderIcon">
                {collapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
            </div>
            <span className="NodeTitle">{title}</span>
            {collapsed && <span className="NodeSummary" title={summary}>{summary}</span>}
            {onDelete && (
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    sx={{ marginLeft: 'auto' }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            )}
        </div>
    );
}

function InputNode({ config, onChange, onSelectPath, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="WorkflowNode input-node">
            <NodeHeader
                title={texts.nodeInput}
                summary={config.path}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeInputPath}</Typography>
                        <TextField
                            variant="standard"
                            size="small"
                            fullWidth
                            value={config.path || ''}
                            onChange={(e) => onChange({ ...config, path: e.target.value })}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={(e) => onSelectPath('input', e.currentTarget)} size="small" edge="end">
                                                <FolderOpenIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function OutputNode({ config, onChange, onSelectPath, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="WorkflowNode output-node">
            <NodeHeader
                title={texts.nodeOutput}
                summary={config.path}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeOutputPath}</Typography>
                        <TextField
                            variant="standard"
                            size="small"
                            fullWidth
                            value={config.path || ''}
                            onChange={(e) => onChange({ ...config, path: e.target.value })}
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => onSelectPath('output')} size="small" edge="end">
                                                <FolderOpenIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function InferenceNode({ config, onChange, onDelete, models, gpuOptions, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    const algoOptions = [...new Set(models.map(m => m.algo))];
    const filteredModels = models.filter(m => m.algo === config.algoName);

    const summary = `${config.algoName || ''} - ${config.modelName || ''}`;

    return (
        <div className="WorkflowNode inference-node">
            <NodeHeader
                title={texts.nodeInference}
                summary={summary}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeAlgorithm}</Typography>
                        <Autocomplete
                            size="small"
                            options={algoOptions}
                            value={config.algoName || ''}
                            onChange={(e, v) => onChange({ ...config, algoName: v || '', modelName: '' })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeModel}</Typography>
                        <Autocomplete
                            size="small"
                            options={filteredModels.map(m => m.name)}
                            value={config.modelName || ''}
                            onChange={(e, v) => onChange({ ...config, modelName: v || '' })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                    <div className="NodeRow" style={{ marginTop: 8 }}>
                        <Typography variant="body2" className="NodeLabel" sx={{ minWidth: 'auto', marginRight: 1 }}>
                            {texts.nodeTileSize}
                        </Typography>
                        <Slider
                            size="small"
                            value={config.tileSize || 64}
                            onChange={(e, v) => onChange({ ...config, tileSize: v })}
                            min={64} max={640} step={64}
                            sx={{ width: 100, mx: 1 }}
                        />
                        <Typography variant="caption" sx={{ minWidth: 30 }}>{config.tileSize}</Typography>

                        <Typography variant="body2" className="NodeLabel" sx={{ minWidth: 'auto', marginLeft: 2, marginRight: 1 }}>
                            {texts.nodeGPU}
                        </Typography>
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={gpuOptions}
                            value={config.gpuId || '0'}
                            onChange={(e, v) => onChange({ ...config, gpuId: v || '0' })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ width: 300 }}
                        />
                        <Typography variant="body2" className="NodeLabel">{texts.nodeSkipAlpha}</Typography>
                        <Checkbox
                            size="small"
                            checked={config.skipAlpha || false}
                            onChange={(e) => onChange({ ...config, skipAlpha: e.target.checked })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ScaleNode({ config, onChange, onDelete, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="WorkflowNode scale-node">
            <NodeHeader
                title={texts.nodeScale}
                summary={config.value}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeScaleValue}</Typography>
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={['1920x1080', '1280x720', '3840x2160', '1/2', '2/1']}
                            value={config.value || ''}
                            onInputChange={(e, v) => onChange({ ...config, value: v })}
                            renderInput={(params) => <TextField {...params} variant="standard" placeholder="1920x1080 or 1/2" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ConditionalJumpNode({ config, onChange, onDelete, labels, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    const summary = `${config.conditionType} ${config.operator} ${config.value} T:${config.trueJumpTo} F:${config.falseJumpTo}`;
    return (
        <div className="WorkflowNode conditional-node">
            <NodeHeader
                title={texts.nodeConditionalJump}
                summary={summary}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeConditionType}</Typography>
                        <Autocomplete
                            size="small"
                            options={['width', 'height']}
                            getOptionLabel={(opt) => opt === 'width' ? texts.nodeConditionWidth : texts.nodeConditionHeight}
                            value={config.conditionType || 'width'}
                            onChange={(e, v) => onChange({ ...config, conditionType: v || 'width' })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ width: 100 }}
                            disableClearable
                        />
                        <Autocomplete
                            size="small"
                            options={['gt', 'lt', 'eq']}
                            getOptionLabel={(opt) => opt === 'gt' ? '>' : opt === 'lt' ? '<' : '='}
                            value={config.operator || 'gt'}
                            onChange={(e, v) => onChange({ ...config, operator: v || 'gt' })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ width: 60 }}
                            disableClearable
                        />
                        <TextField
                            variant="standard"
                            size="small"
                            type="number"
                            value={config.value || 0}
                            onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) || 0 })}
                            sx={{ width: 80 }}
                        />
                    </div>
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeTrueJumpTo}</Typography>
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={labels}
                            value={config.trueJumpTo || ''}
                            onInputChange={(e, v) => onChange({ ...config, trueJumpTo: v })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeFalseJumpTo}</Typography>
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={labels}
                            value={config.falseJumpTo || ''}
                            onInputChange={(e, v) => onChange({ ...config, falseJumpTo: v })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function JumpNode({ config, onChange, onDelete, labels, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="WorkflowNode jump-node">
            <NodeHeader
                title={texts.nodeJump}
                summary={config.jumpTo}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeJumpTo}</Typography>
                        <Autocomplete
                            size="small"
                            freeSolo
                            options={labels}
                            value={config.jumpTo || ''}
                            onInputChange={(e, v) => onChange({ ...config, jumpTo: v })}
                            renderInput={(params) => <TextField {...params} variant="standard" />}
                            sx={{ flex: 1 }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function LabelNode({ config, onChange, onDelete, texts }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <div className="WorkflowNode label-node">
            <NodeHeader
                title={texts.nodeLabel}
                summary={config.name}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="NodeContent">
                    <div className="NodeRow">
                        <Typography variant="body2" className="NodeLabel">{texts.nodeLabelName}</Typography>
                        <TextField
                            variant="standard"
                            size="small"
                            value={config.name || ''}
                            onChange={(e) => onChange({ ...config, name: e.target.value })}
                            sx={{ flex: 1 }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function WorkflowUI({ webDevMode, texts }) {
    const [inputConfig, setInputConfig] = useState({ path: '', inputType: 'Image' });
    const [outputConfig, setOutputConfig] = useState({ path: '' });
    const [nodes, setNodes] = useState([]);
    const [models, setModels] = useState([]);
    const [gpuOptions, setGpuOptions] = useState([]);
    const [dragOverIndex, setDragOverIndex] = useState(-1);
    const [running, setRunning] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    // Workflow Management
    const [workflowList, setWorkflowList] = useState([]);
    const [currentWorkflowName, setCurrentWorkflowName] = useState('');
    const [isNewWorkflow, setIsNewWorkflow] = useState(true);

    // Progress state
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('0% ETR:--:--:--');
    const [totalProgressText, setTotalProgressText] = useState('');
    
    // Process state for alerts
    const [processState, setProcessState] = useState('idle');
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        if (webDevMode) {
            setModels([
                { name: 'model1', algo: 'real-esrgan', scale: 4 },
                { name: 'model2', algo: 'real-hatgan', scale: 4 },
                { name: 'model3', algo: 'moe-ir', scale: 1 }
            ]);
            setGpuOptions(['0', 'NVIDIA GeForce RTX 2060']);
            setWorkflowList(['Default', 'Upscale 4x']);
        } else {
            getAllModels().then(setModels);
            getGpuList().then(setGpuOptions);
            getWorkflowList().then(setWorkflowList);
        }
    }, [webDevMode]);

    const refreshWorkflowList = () => {
        if (!webDevMode) {
            getWorkflowList().then(setWorkflowList);
        }
    };

    const loadWorkflow = async (name) => {
        if (!name) return;
        
        if (webDevMode) {
            console.log('Loading workflow:', name);
            setCurrentWorkflowName(name);
            setIsNewWorkflow(false);
            return;
        }

        const data = await loadBackendWorkflow(name);
        if (data) {
            setInputConfig(data.input || { path: '', inputType: 'Image' });
            setOutputConfig(data.output || { path: '' });
            setNodes(data.nodes || []);
            setCurrentWorkflowName(name);
            setIsNewWorkflow(false);
        } else {
            console.error(texts.workflowLoadError);
        }
    };

    const saveWorkflow = async () => {
        if (!currentWorkflowName) return;

        const workflowData = {
            input: inputConfig,
            output: outputConfig,
            nodes: nodes
        };

        if (webDevMode) {
            console.log('Saving workflow:', currentWorkflowName, workflowData);
            if (isNewWorkflow) {
                setWorkflowList([...workflowList, currentWorkflowName]);
                setIsNewWorkflow(false);
            }
        } else {
            const success = await saveBackendWorkflow(currentWorkflowName, workflowData);
            if (success) {
                refreshWorkflowList();
                setIsNewWorkflow(false);
                // Optional: Show success message
            }
        }
    };

    const handleNewWorkflow = () => {
        setInputConfig({ path: '', inputType: 'Image' });
        setOutputConfig({ path: '' });
        setNodes([]);
        setCurrentWorkflowName('');
        setIsNewWorkflow(true);
    };

    const labels = nodes
        .filter(n => n.type === NODE_TYPES.label)
        .map(n => n.config.name)
        .filter(Boolean);

    const handleDragStart = (e, nodeType) => {
        e.dataTransfer.setData('nodeType', nodeType);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragLeave = () => {
        setDragOverIndex(-1);
    };

    const handleDrop = (e, index) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('nodeType');
        if (nodeType) {
            const newNode = {
                id: generateId(),
                type: nodeType,
                config: getDefaultConfig(nodeType)
            };
            const newNodes = [...nodes];
            newNodes.splice(index, 0, newNode);
            setNodes(newNodes);
        }
        setDragOverIndex(-1);
    };

    const updateNodeConfig = (index, newConfig) => {
        const newNodes = [...nodes];
        newNodes[index].config = newConfig;
        setNodes(newNodes);
    };

    const deleteNode = (index) => {
        const newNodes = [...nodes];
        newNodes.splice(index, 1);
        setNodes(newNodes);
    };

    const handleSelectPath = async (type, target) => {
        if (type === 'input') {
            setAnchorEl(target);
        } else {
            const result = await openFileOrFolder('folder');
            if (result) {
                setOutputConfig({ ...outputConfig, path: result.path });
            }
        }
    };

    const handleInputSelect = async (mode) => {
        setAnchorEl(null);
        const result = await openFileOrFolder(mode);
        if (result) {
            setInputConfig({
                path: result.path,
                inputType: result.type === 'directory' ? 'Folder' : 'Image'
            });
        }
    };

    const handleAlertClose = () => {
        setProcessState('idle');
        setAlertMessage('');
    };

    // Validate workflow nodes before running
    const validateWorkflow = () => {
        // Check input/output paths
        if (!inputConfig.path) {
            setAlertMessage(texts.workflowMissingInput);
            setProcessState('validation');
            return false;
        }
        if (!outputConfig.path) {
            setAlertMessage(texts.workflowMissingOutput);
            setProcessState('validation');
            return false;
        }
        
        // Check each node's required parameters
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const nodeNum = i + 1;
            
            if (node.type === 'inference') {
                if (!node.config.algoName || !node.config.modelName) {
                    setAlertMessage(`${texts.nodeInference} ${nodeNum}: ${texts.workflowMissingModel}`);
                    setProcessState('validation');
                    return false;
                }
            } else if (node.type === 'scale') {
                if (!node.config.value) {
                    setAlertMessage(`${texts.nodeScale} ${nodeNum}: ${texts.workflowMissingValue}`);
                    setProcessState('validation');
                    return false;
                }
            } else if (node.type === 'label') {
                if (!node.config.name) {
                    setAlertMessage(`${texts.nodeLabel} ${nodeNum}: ${texts.workflowMissingName}`);
                    setProcessState('validation');
                    return false;
                }
            }
            // jump and conditional_jump don't require jumpTo (can fall through)
        }
        return true;
    };

    const runWorkflow = () => {
        handleAlertClose();
        
        if (!validateWorkflow()) {
            return;
        }
        
        const workflowData = {
            input: inputConfig,
            output: outputConfig,
            nodes: nodes
        };

        if (webDevMode) {
            console.log('Running workflow:', workflowData);
        } else {
            setRunning(true);
            runBackendWorkflow(workflowData);
        }
    };

    useEffect(() => {
        if (!webDevMode) {
            const handleProcessState = (state) => {
                if (state === 'finish') {
                    setRunning(false);
                    setProcessState('finish');
                } else if (state === 'error') {
                    setRunning(false);
                    setProcessState('error');
                }
            };
            const disposeState = expose(handleProcessState, 'handleSetProcessState');
            
            // Register progress callback (same as InferenceUI)
            const handleSetProgress = (progressNum, singleProgressText, totalProgressText) => {
                setProgress(progressNum);
                setProgressText(singleProgressText);
                setTotalProgressText(totalProgressText);
            };
            const disposeProgress = expose(handleSetProgress, 'handleSetProgress');
            
            // Register error callback
            const showError = (errorText) => {
                showErrorDialog(errorText);
                setProcessState('idle');
            };
            const disposeError = expose(showError, 'showError');

            return () => {
                disposeState();
                disposeProgress();
                disposeError();
            };
        }
    }, [webDevMode]);

    const renderNode = (node, index) => {
        const commonProps = {
            config: node.config,
            onChange: (newConfig) => updateNodeConfig(index, newConfig),
            onDelete: () => deleteNode(index),
            texts
        };

        switch (node.type) {
            case NODE_TYPES.inference:
                return <InferenceNode {...commonProps} models={models} gpuOptions={gpuOptions} />;
            case NODE_TYPES.scale:
                return <ScaleNode {...commonProps} />;
            case NODE_TYPES.conditional_jump:
                return <ConditionalJumpNode {...commonProps} labels={labels} />;
            case NODE_TYPES.jump:
                return <JumpNode {...commonProps} labels={labels} />;
            case NODE_TYPES.label:
                return <LabelNode {...commonProps} />;
            default:
                return null;
        }
    };

    return (
        <div className="WorkflowContainer">
            <div className="NodePalette">
                <h4>{texts.workflowNodePalette}</h4>
                <div className="PaletteNode" draggable onDragStart={(e) => handleDragStart(e, NODE_TYPES.inference)}>
                    {texts.nodeInference}
                </div>
                <div className="PaletteNode" draggable onDragStart={(e) => handleDragStart(e, NODE_TYPES.scale)}>
                    {texts.nodeScale}
                </div>
                <div className="PaletteNode" draggable onDragStart={(e) => handleDragStart(e, NODE_TYPES.conditional_jump)}>
                    {texts.nodeConditionalJump}
                </div>
                <div className="PaletteNode" draggable onDragStart={(e) => handleDragStart(e, NODE_TYPES.jump)}>
                    {texts.nodeJump}
                </div>
                <div className="PaletteNode" draggable onDragStart={(e) => handleDragStart(e, NODE_TYPES.label)}>
                    {texts.nodeLabel}
                </div>
            </div>

            <div className="WorkflowCanvas">
                <div className="WorkflowToolbar">
                    <Autocomplete
                        size="small"
                        freeSolo
                        options={workflowList}
                        value={currentWorkflowName}
                        onInputChange={(e, v) => {
                            setCurrentWorkflowName(v);
                            if (workflowList.includes(v)) {
                                loadWorkflow(v);
                            } else {
                                setIsNewWorkflow(true);
                            }
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                variant="standard"
                                placeholder={texts.workflowNamePlaceholder}
                                sx={{ minWidth: 200 }}
                            />
                        )}
                        sx={{ flex: 1, maxWidth: 300 }}
                    />
                    <IconButton onClick={saveWorkflow} disabled={!currentWorkflowName} title={texts.workflowSave}>
                        <SaveIcon />
                    </IconButton>
                    <IconButton onClick={handleNewWorkflow} title={texts.workflowNew}>
                        <AddIcon />
                    </IconButton>
                </div>

                <div className="CanvasScrollArea">
                    <div className="CanvasContent">
                        <InputNode
                            config={inputConfig}
                            onChange={setInputConfig}
                            onSelectPath={handleSelectPath}
                            texts={texts}
                        />
                        <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
                            <MenuItem onClick={() => handleInputSelect('file')}>
                                {texts.inferInputImage?.replace(/[:：]$/, '')}
                            </MenuItem>
                            <MenuItem onClick={() => handleInputSelect('folder')}>
                                {texts.inferInputFolder?.replace(/[:：]$/, '')}
                            </MenuItem>
                        </Menu>

                        {nodes.length === 0 ? (
                            <div
                                className={`EmptyDropZone ${dragOverIndex === 0 ? 'drag-over' : ''}`}
                                onDragOver={(e) => handleDragOver(e, 0)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 0)}
                            >
                                {texts.workflowDragHint}
                            </div>
                        ) : (
                            nodes.map((node, index) => (
                                <div
                                    key={node.id}
                                    className={`NodeWrapper ${dragOverIndex === index ? 'drag-over' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, index)}
                                >
                                    {renderNode(node, index)}
                                </div>
                            ))
                        )}

                        {nodes.length > 0 && (
                            <div
                                className={`NodeWrapper ${dragOverIndex === nodes.length ? 'drag-over' : ''}`}
                                onDragOver={(e) => handleDragOver(e, nodes.length)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, nodes.length)}
                            >
                                <OutputNode
                                    config={outputConfig}
                                    onChange={setOutputConfig}
                                    onSelectPath={handleSelectPath}
                                    texts={texts}
                                />
                            </div>
                        )}

                        {nodes.length === 0 && (
                            <OutputNode
                                config={outputConfig}
                                onChange={setOutputConfig}
                                onSelectPath={handleSelectPath}
                                texts={texts}
                            />
                        )}
                    </div>
                </div>

                {running && (
                    <SingleProgressBar
                        progress={progress}
                        progressText={progressText}
                        totalText={totalProgressText}
                        isBatch={inputConfig.inputType === 'Folder'}
                        texts={texts}
                    />
                )}

                {processState === 'finish' && (
                    <Alert severity="success" onClose={handleAlertClose} sx={{ mb: 1 }}>
                        {texts.workflowFinished}
                    </Alert>
                )}
                {processState === 'error' && (
                    <Alert severity="error" onClose={handleAlertClose} sx={{ mb: 1 }}>
                        {texts.workflowError}
                    </Alert>
                )}
                {processState === 'validation' && (
                    <Alert severity="info" onClose={handleAlertClose} sx={{ mb: 1 }}>
                        {alertMessage}
                    </Alert>
                )}

                <div className="RunButtonContainer">
                    <Button variant="outlined" color='lightPink'
                            sx={{ width: '100%', padding: '10px' }}
                            loading={running}
                            startIcon={<></>}
                            loadingPosition="start"
                            onClick={runWorkflow}
                            disabled={running}
                        >{running ? texts.workflowRunning : texts.workflowRun}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default WorkflowUI;
