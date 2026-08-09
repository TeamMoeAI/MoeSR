class FrontendBridge:
    """Small facade for the three callbacks that Python may invoke in JavaScript."""

    def __init__(self):
        self._sender = None

    def bind(self, sender):
        self._sender = sender

    def unbind(self, sender):
        if self._sender is sender:
            self._sender = None

    def handleSetProgress(self, percent, progress_text, total_progress_text):
        self._call('handleSetProgress', percent, progress_text, total_progress_text)

    def showError(self, error_text):
        self._call('showError', error_text)

    def handleSetProcessState(self, state):
        self._call('handleSetProcessState', state)

    def _call(self, name, *args):
        if self._sender is not None:
            self._sender({
                'type': 'js_call',
                'name': name,
                'args': list(args),
            })


frontend = FrontendBridge()
