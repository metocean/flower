import os

import tornado.web
import tornado.websocket
from ..utils import strtobool
from ..views import BaseHandler


class BaseWebSocketHandler(tornado.websocket.WebSocketHandler):
    # listeners = [], should be created in derived class

    def open(self):
        listeners = self.listeners
        listeners.append(self)

    def on_message(self, message):
        pass

    def on_close(self):
        listeners = self.listeners
        if self in listeners:
            listeners.remove(self)

    @classmethod
    def send_message(cls, message):
        for l in cls.listeners:
            l.write_message(message)

class BaseApiHandler(BaseHandler):
    def prepare(self):
        enable_api = strtobool(os.environ.get(
            'FLOWER_UNAUTHENTICATED_API') or "false")
        if not (self.application.options.basic_auth or self.application.options.auth) and not enable_api:
            raise tornado.web.HTTPError(
                401, "FLOWER_UNAUTHENTICATED_API environment variable is required to enable API without authentication")

    def write_error(self, status_code, **kwargs):
        exc_info = kwargs.get('exc_info')
        log_message = exc_info[1].log_message
        if log_message:
            self.write(log_message)
        self.set_status(status_code)
        self.finish()
