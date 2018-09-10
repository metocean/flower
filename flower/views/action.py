from __future__ import absolute_import

import copy
import logging
import ast

try:
    from itertools import imap
except ImportError:
    imap = map

from tornado import web

from ..views import BaseHandler
from ..utils.tasks import iter_tasks, get_task_by_id, as_dict
from ..utils.actions import get_action_conf, get_log

from scheduler.core import get_action_logfile

logger = logging.getLogger(__name__)

class ActionView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        task = get_task_by_id(self.application.events, task_id)

        if task is None:
            raise web.HTTPError(404, "Unknown task '%s'" % task_id)

        task.kwargs = ast.literal_eval(str(task.kwargs))

        cycle_dt = task.kwargs.get('cycle_dt',  None)
        action_id = task.kwargs.get('action_id',  None)
        
        if action_id and cycle_dt:
            logfile, logpath = get_log(get_action_logfile(action_id, cycle_dt))
        else:
            logfile, logpath = (None, None)

        action_conf = get_action_conf(action_id) if action_id else None


        self.render("action.html", task=task, 
                                   action_id=action_id,
                                   action_conf=action_conf,
                                   logfile=logfile,
                                   logpath=logpath,
                                   cycle_dt=cycle_dt)