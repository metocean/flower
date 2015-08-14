from __future__ import absolute_import

import logging
import os

from functools import partial
from pprint import pformat

import tailer 

from tornado import websocket
from tornado.ioloop import PeriodicCallback

from . import settings
from ..models import WorkersModel, TaskModel

from scheduler.core import load_action
from scheduler.settings import LOGDIR

logger = logging.getLogger(__name__)


class Tailer(tailer.Tailer):
    """docstring for Tailer"""
    def follow(self):
        """\
        Iterator generator that returns lines as data is added to the file.

        Based on: http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/157035
        """
        trailing = True       
        if not hasattr(self, 'where'):
            self.where = self.file.tell()
        else:
            self.seek(self.where)
        for line in self.file:
            if trailing and line in self.line_terminators:
                # This is just the line terminator added to the end of the file
                # before a new line, ignore.
                trailing = False
                continue

            if line[-1] in self.line_terminators:
                line = line[:-1]
                if line[-1:] == '\r\n' and '\r\n' in self.line_terminators:
                    # found crlf
                    line = line[:-1]

            trailing = False
            yield line
            self.where = self.file.tell()

class UpdateWorkers(websocket.WebSocketHandler):
    listeners = []
    periodic_callback = None
    workers = None

    def open(self):
        if not settings.AUTO_REFRESH:
            self.write_message({})
            return

        app = self.application

        if not self.listeners:
            logger.debug('Starting a timer for dashboard updates')
            periodic_callback = self.periodic_callback or PeriodicCallback(
                partial(UpdateWorkers.on_update_time, app),
                settings.PAGE_UPDATE_INTERVAL)
            if not periodic_callback._running:
                periodic_callback.start()
        self.listeners.append(self)

    def on_message(self, message):
        pass

    def on_close(self):
        if self in self.listeners:
            self.listeners.remove(self)
        if not self.listeners and self.periodic_callback:
            logger.debug('Stopping dashboard updates timer')
            self.periodic_callback.stop()

    @classmethod
    def on_update_time(cls, app):
        workers = WorkersModel.get_latest(app)
        changes = workers.workers

        if workers != cls.workers and changes:
            logger.debug('Sending dashboard updates: %s', pformat(changes))
            for l in cls.listeners:
                l.write_message(changes)
            cls.workers = workers
        
            
class UpdateLogfile(websocket.WebSocketHandler):
    listeners = {}
    periodic_callback = None
    logfiles = {}
    tails = {}

    def open(self, logpath):
        self.logpath = logpath
        if os.path.exists(logpath):
            if logpath not in self.logfiles.keys():
                self.logfiles[logpath] = open(logpath)

            if logpath not in self.tails.keys():
                self.tails[logpath] = Tailer(self.logfiles[logpath], end=True)
        else:
            return

        if not settings.AUTO_REFRESH:
            self.write_message({})
            return

        app = self.application

        if not self.listeners:
            logger.debug('Starting to follow the log file tail')
            periodic_callback = self.periodic_callback or PeriodicCallback(
                partial(UpdateLogfile.on_update_time, app),
                settings.PAGE_UPDATE_INTERVAL)
            if not periodic_callback._running:
                periodic_callback.start()
        if logpath not in self.listeners.keys():
            self.listeners[logpath] = [self]
        else:
            self.listeners[logpath].append(self)

    def on_message(self, message):
        pass

    def on_close(self):
        for logpath, listeners in self.listeners.items():
            if self in listeners:
                self.listeners[logpath].remove(self)
            if not self.listeners[logpath]:
                self.listeners.pop(logpath)
                self.tails.pop(logpath)
                self.logfiles[logpath].close()
                self.logfiles.pop(logpath)

        if not self.listeners and self.periodic_callback:
            logger.debug('Stopping dashboard updates timer')
            self.periodic_callback.stop()

    @classmethod
    def on_update_time(cls, app):
        for logpath in cls.tails.keys():
            for newline in cls.tails[logpath]:
                for l in cls.listeners[logpath]:
                    l.write_message(newline)