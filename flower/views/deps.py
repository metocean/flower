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
from scheduler.core import evaluate_cycles,load_workflows
from scheduler.action import resolve_deps
from scheduler.beat import SchedulerBeat


def resolve_deps_for_cycle(action_id, cycle_dt,):
    cycles_dt, cycles_str = evaluate_cycles(cycle_dt)
    cycle_dt = cycles_dt[0]

    beat = SchedulerBeat(now=cycle_dt)

    if cycle_dt not in beat.cycles_workflows:
        return []
    else:
        workflow = beat.cycles_workflows[cycle_dt]
        return resolve_deps(action_id, workflow, upstream=True)
    
class DependencyPydotView(BaseHandler):
    def __init__(self, *args, **kwargs):
        super(DependencyPydotView, self).__init__(*args,**kwargs)
        self.pool = self.application.pool

    @run_on_executor(executor='pool')
    def _plot_deps(self, task_id):
        task = get_task_by_id(self.application.events, task_id)
        if task:
            output = '/tmp/%s.png' % task_id
            if not os.path.exists(output):
                actions_id = getattr(task,'actions_id',[])
                workflows_id = getattr(task,'workflows_id',[])
                if actions_id or workflows_id:
                    workflow = load_workflows(workflows_id)+actions_id
                else:
                    workflow = resolve_deps_for_cycle(task.action_id, 
                                                      task.cycle_dt)+\
                                                      [task.action_id]
                if workflow:
                    try:
                        SchedulerCommand(['deps', '-c', task.cycle_dt, '-w', ','.join(workflow), '-o', output]).command()
                    except SystemExit as exc:
                        if exc.code == 0:
                            pass
                        else:
                            return self.write_error(500, exc_info=sys.exc_info())
                    except Exception as exc:
                        return self.write_error(500, exc_info=sys.exc_info())
                else:
                    return self.render('404.html', message="Task has no dependencies")
        else:
            return self.render('404.html', message="Task UUID Not found")

        with open(output, 'rb') as dep_plot:
            self.set_header("Content-Type", "image/png")
            return dep_plot.read()

    @web.authenticated
    @tornado.gen.coroutine
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        result = yield self._plot_deps(task_id)
        if result:
            self.write(result)