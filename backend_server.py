import argparse
import asyncio
import json
import logging
from pathlib import Path

from websockets.asyncio.server import serve

import moe_sr
from app_logging import configure_logging
from frontend_bridge import frontend

PROCESS_METHODS = {'py_run_process', 'py_run_workflow', 'py_run_quick_workflow'}
process_lock = asyncio.Lock()
logger = logging.getLogger('moesr.backend')


def call_api(service, method, params):
    if method == 'py_get_model_list':
        return service.py_get_model_list(params['algoName'])
    if method == 'py_get_all_models':
        return service.py_get_all_models()
    if method == 'py_get_gpu_list':
        return service.py_get_gpu_list()
    if method == 'py_get_settings':
        return service.py_get_settings()
    if method == 'py_save_settings':
        return service.py_save_settings(params['settings'])
    if method == 'py_get_workflow_list':
        return service.py_get_workflow_list()
    if method == 'py_load_workflow':
        return service.py_load_workflow(params['name'])
    if method == 'py_save_workflow':
        return service.py_save_workflow(params['name'], params['data'])
    if method == 'py_run_process':
        return service.py_run_process(
            params['modelName'],
            params['tileSize'],
            params['scale'],
            params['isSkipAlpha'],
            params.get('resizeTo', ''),
            params['inputType'],
            params['inputImage'],
            params['outputPath'],
            params['gpuid'],
            params['algoName'],
            params.get('scalingMode', 'manual'),
            params.get('targetResolution', ''),
        )
    if method == 'py_run_workflow':
        return service.py_run_workflow(params['workflowData'])
    if method == 'py_run_quick_workflow':
        return service.py_run_quick_workflow(
            params['workflowName'],
            params['sourcePath'],
        )

    raise ValueError(f'Unknown API method: {method}')


async def send_messages(websocket, outbox):
    while True:
        message = await outbox.get()
        await websocket.send(json.dumps(message, ensure_ascii=False))


async def handle_request(service, message, outbox):
    request_id = message.get('id')
    method = message.get('method')
    params = message.get('params') or {}

    try:
        if not isinstance(method, str):
            raise ValueError('Request method must be a string')

        if method in PROCESS_METHODS:
            # Serial execution of image processing tasks
            async with process_lock:
                result = await asyncio.to_thread(call_api, service, method, params)
        else:
            result = await asyncio.to_thread(call_api, service, method, params)

        await outbox.put({
            'type': 'response',
            'id': request_id,
            'result': result,
        })
    except Exception as error:
        logger.exception('Backend request failed: method=%s', method)
        await outbox.put({
            'type': 'response',
            'id': request_id,
            'error': {
                'code': 'BACKEND_ERROR',
                'message': str(error),
            },
        })


async def handle_client(service, websocket):
    # Get the main thread's event loop
    loop = asyncio.get_running_loop()
    # Create an outbox for the connection
    outbox = asyncio.Queue()

    # Schedule messages from other threads to be processed in the current loop
    def send_to_frontend(message):
        loop.call_soon_threadsafe(outbox.put_nowait, message)

    frontend.bind(send_to_frontend)
    sender_task = asyncio.create_task(send_messages(websocket, outbox))
    request_tasks = set()

    try:
        # Message loop
        async for raw_message in websocket:
            message = json.loads(raw_message)
            if message.get('type') != 'request':
                continue

            task = asyncio.create_task(handle_request(service, message, outbox))
            request_tasks.add(task)
            task.add_done_callback(request_tasks.discard)
    finally:
        # Cleanup upon disconnection
        frontend.unbind(send_to_frontend)
        sender_task.cancel()
        for task in request_tasks:
            task.cancel()


async def run_server(port, data_dir):
    service = moe_sr.MoeSRService(data_dir, frontend)

    # Create a WebSocket service; call handle_client when a connection is established
    async with serve(
            lambda websocket: handle_client(service, websocket),
            '127.0.0.1',
            port,
            max_size=4 * 1024 * 1024,
    ) as server:
        logger.info('Backend ready on ws://127.0.0.1:%s', port)
        await server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description='MoeSR local WebSocket backend')
    parser.add_argument('--port', type=int, default=10721)
    parser.add_argument('--data-dir', type=Path, default="MoeSRData")
    args = parser.parse_args()

    data_dir = args.data_dir.resolve()
    configure_logging(data_dir, frontend)
    asyncio.run(run_server(args.port, data_dir))


if __name__ == '__main__':
    main()
