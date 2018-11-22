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

from scheduler.core import *

logger = logging.getLogger(__name__)

class ActionsView(BaseHandler):
    @web.authenticated
    def get(self):
        self.render("actions.html")


class ActionsData(BaseHandler):
    @web.authenticated
    def get(self):
        actions = sorted(DISCOVERED_ACTIONS.keys())
        active = ACTIVE_ACTIONS
        self.write(dict(actions=actions, active=active))

class ActionData(BaseHandler):
    @web.authenticated
    def get(self, action_id):
        config = get_action_conf(action_id)
        wrapper_tasks = ['wrappers.WrapperTask',
                         'wrappers.SubprocessTask',
                         'chain.GroupChainTask']
        all_tasks = []
        
        tasks = [as_dict(t) for _,t in iter_tasks(self.application.events,
                                                  type=wrapper_tasks,
                                                  actions=[action_id])]
        
        self.write(dict(config=config, tasks=tasks))