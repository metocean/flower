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
from scheduler.flow import CyclicFlow


def resolve_deps_for_cycle(action_id, cycle_dt):
    if isinstance(cycle_dt, (str, unicode)):
        cycle_hour = datetime.datetime.strptime(cycle_dt, 
                    settings.CYCLE_DATETIME_PATTERN).hour
    elif isinstance(cycle_dt, datetime.datetime):
        cycle_hour = cycle_dt.hour
    else:
        return []
    flow = CyclicFlow()
    if cycle_hour not in flow.cycle_hours:
        return []
    else:
        workflow = flow.cycle_hours[cycle_hour]
        deps = resolve_deps(action_id, workflow)
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
        workflow = task.workflow or get_workflow_for_task(task)
        if workflow:
            output = '/tmp/%s.png' % task_id
            if not os.path.exists(output):
                try:
                    command = SchedulerCommand(['deps','-w', ','.join(workflow),
                                                '-o', output])
                    command.run()
                except SystemExit as exc:
                    if exc.code == 0:
                        pass
                    else:
                        raise Exception('Dependency graph error')
            with open(output) as dep_plot:
                return dep_plot.read()
        else:
            return self.render('404.html', message="Task has no dependencies")

    @web.authenticated
    @tornado.gen.coroutine
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        result = yield self._plot_deps(task_id)
        self.set_header("Content-Type", "image/png")
        self.write(result)    

class DependencySankeyView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        task = get_task_by_id(self.application.events, task_id)
        workflow = task.workflow or get_workflow_for_task(task)
        logging.warn(workflow)
        if workflow:
            tree = gen_deps_tree(workflow)
            cache = shelve.open('/tmp/sankey_cache.shelve')
            task_id = str(task_id)
            if cache.has_key(task_id):
                table = cache[task_id]
            else:
                table = []    
                for action_id, deps in tree.items():
                    row = []
                    for dep_id in deps['hard']:
                        row.append([action_id,dep_id,1,'true','hard'])
                    for dep_id in deps['soft']:
                        row.append([action_id,dep_id,0.1,'false','soft'])
                    table.extend(row)
                cache[task_id] = table
            cache.close()
            self.render('deps.html', table=table)
        else:
            self.render('404.html', message="Task has no dependencies")