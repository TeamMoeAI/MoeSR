import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path


APP_LOGGER_NAME = "moesr"


class FrontendNotificationHandler(logging.Handler):
    """Forward application warnings and errors to the Electron frontend."""

    def __init__(self, frontend_bridge):
        super().__init__(level=logging.WARNING)
        self.frontend = frontend_bridge

    def emit(self, record):
        try:
            if record.levelno >= logging.ERROR:
                # Formatter.format appends exception information when exc_info is set.
                self.frontend.showError(self.format(record))
            else:
                # Keep warning dialogs concise; tracebacks still remain in the log file.
                self.frontend.showWarning(record.getMessage())
        except Exception:
            self.handleError(record)


def configure_logging(data_dir, frontend_bridge):
    """Configure MoeSR file, console, and frontend logging."""
    logs_dir = Path(data_dir) / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_path = logs_dir / "moesr.log"

    root_logger = logging.getLogger()
    if getattr(root_logger, "_moesr_configured", False):
        return log_path

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s [%(threadName)s] %(message)s"
    )

    file_handler = RotatingFileHandler(
        log_path,
        maxBytes=5 * 1024 * 1024,
        backupCount=4,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)

    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    root_logger._moesr_configured = True

    app_logger = logging.getLogger(APP_LOGGER_NAME)
    app_logger.setLevel(logging.DEBUG)

    frontend_handler = FrontendNotificationHandler(frontend_bridge)
    frontend_handler.setFormatter(logging.Formatter("%(message)s"))
    app_logger.addHandler(frontend_handler)

    logging.captureWarnings(True)
    app_logger.debug("Logging initialized: %s", log_path)
    return log_path
