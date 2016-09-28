from __future__ import absolute_import

import sys
import copy
import logging
import ast
import os

try:
    from itertools import imap
except ImportError:
    imap = map

from tornado import web
from ..views import BaseHandler

from scheduler.command.__main__ import SchedulerCommand

class DependencyView(BaseHandler):
    @web.authenticated
    def get(self, task_id, cycle_dt):
        app = self.application
        capp = self.application.capp
        workflow = self.get_argument('workflow', type=str)

        output = '/tmp/%s_%s.png' % (cycle_dt,task_id)
        if not os.path.exists(output):
            try:
                command = SchedulerCommand(['deps','-a', workflow,
                                        '-o', output])
                command.run()
            except SystemExit as exc:
                if exc.code == 0:
                    pass
                else:
                    self.write_error(404, exc_info='Could not generate or find dependencies plot graph')

        self.set_header("Content-Type", "image/png")
        with open(output) as dep_plot:
            self.write(dep_plot.read())