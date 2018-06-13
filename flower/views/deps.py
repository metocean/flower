from __future__ import absolute_import

import sys
import copy
import logging
import ast
import os
import shelve
import datetime

try:
    from itertools import imap
except ImportError:
    imap = map

import tornado
from tornado import web
from tornado.concurrent import run_on_executor

from ..views import BaseHandler
from ..utils.tasks import get_task_by_id

from scheduler import settings
from scheduler.command.__main__ import SchedulerCommand
from scheduler.core import gen_deps_tree, resolve_deps
from scheduler.beat import SchedulerBeat


def resolve_deps_for_cycle(action_id, cycle_dt):
    if isinstance(cycle_dt, (str, unicode)):
        cycle_hour = datetime.datetime.strptime(cycle_dt, 
                    settings.CYCLE_DATETIME_PATTERN).hour
    elif isinstance(cycle_dt, datetime.datetime):
        cycle_hour = cycle_dt.hour
    else:
        return []
    beat = SchedulerBeat()
    if cycle_hour not in beat.cycle_hours:
        return []
    else:
        workflow = beat.cycle_hours[cycle_hour]
        deps = resolve_deps(action_id, workflow, upstream=True)
        return deps

def get_workflow_for_task(task):
    workflow  = []
    if task.action_id and task.cycle_dt:
        workflow += [task.action_id]
        workflow += resolve_deps_for_cycle(task.action_id, 
                                           task.cycle_dt)
    return workflow
    
class DependencyPydotView(BaseHandler):
    def __init__(self, *args, **kwargs):
        super(DependencyPydotView, self).__init__(*args,**kwargs)
        self.pool = self.application.pool

    @run_on_executor(executor='pool')
    def _plot_deps(self, task_id):
        task = get_task_by_id(self.application.events, task_id)
        output = '/tmp/%s_%s.png' % (task.action_id, task.cycle_dt)
        if not os.path.exists(output):
            workflow = task.workflow or get_workflow_for_task(task)
            if workflow:
                try:
                    command = SchedulerCommand(['deps','-w', ','.join(workflow),
                                                    '-o', output])
                    command.run()
                except SystemExit as exc:
                    if exc.code == 0:
                        pass
                    else:
                        raise Exception('Dependency graph error')
            else:
                return self.render('404.html', message="Task has no dependencies")

        with open(output) as dep_plot:
            self.set_header("Content-Type", "image/png")
            return dep_plot.read()

    @web.authenticated
    @tornado.gen.coroutine
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        result = yield self._plot_deps(task_id)
        self.write(result)