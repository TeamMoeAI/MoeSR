class FrontendBridge:
    """Small facade for callbacks that Python may invoke in JavaScript."""

    def __init__(self):
        self._sender = None
        self._pending_notifications = []

    def bind(self, sender):
        self._sender = sender
        pending = self._pending_notifications
        self._pending_notifications = []
        for name, args in pending:
            self._call(name, *args)

    def unbind(self, sender):
        if self._sender is sender:
            self._sender = None

    def handleSetProgress(self, percent, progress_text, total_progress_text):
        self._call('handleSetProgress', percent, progress_text, total_progress_text)

    def showError(self, error_text):
        self._notify('showError', error_text)

    def showWarning(self, warning_text):
        self._notify('showWarning', warning_text)

    def handleSetProcessState(self, state):
        self._call('handleSetProcessState', state)

    def _notify(self, name, *args):
        if self._sender is None:
            # Service initialization happens before the WebSocket is connected.
            self._pending_notifications.append((name, args))
            return
        self._call(name, *args)

    def _call(self, name, *args):
        if self._sender is not None:
            self._sender({
                'type': 'js_call',
                'name': name,
                'args': list(args),
            })


frontend = FrontendBridge()
