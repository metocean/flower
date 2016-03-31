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
from ..utils.actions import get_action_conf, get_logfile

logger = logging.getLogger(__name__)


class TaskView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        task = get_task_by_id(self.application.events, task_id)

        if task is None:
            raise web.HTTPError(404, "Unknown task '%s'" % task_id)

        task.kwargs = ast.literal_eval(str(task.kwargs))
        cycle_dt = task.kwargs.get('cycle_dt',  None)
        action_id = task.kwargs.get('action_id',  None)
        logfile, logpath = get_logfile(action_id) if action_id else (None,None)
        action_conf = get_action_conf(action_id) if action_id else None

        self.render("task.html", task=task,
                                 action_id=action_id,
                                 action_conf=action_conf,
                                 logfile=logfile,
                                 logpath=logpath,
                                 cycle_dt=cycle_dt)


class TasksDataTable(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        draw = self.get_argument('draw', type=int)
        start = self.get_argument('start', type=int)
        length = self.get_argument('length', type=int)
        search = self.get_argument('search[value]', type=str)

        column = self.get_argument('order[0][column]', type=int)
        sort_by = self.get_argument('columns[%s][data]' % column, type=str)
        sort_order = self.get_argument('order[0][dir]', type=str) == 'asc'

        tasks = sorted(iter_tasks(app.events, search=search),
                       key=lambda x: getattr(x[1], sort_by),
                       reverse=sort_order)
        tasks = list(map(self.format_task, tasks))
        filtered_tasks = []
        i = 0
        for _, task in tasks:
            if i < start:
                i += 1
                continue
            if i >= (start + length):
                break
            task = as_dict(task)
            task['worker'] = getattr(task.get('worker',None),'hostname',None)
            filtered_tasks.append(task)
            i += 1

        self.write(dict(draw=draw, data=filtered_tasks,
                        recordsTotal=len(tasks),
                        recordsFiltered=len(tasks)))

    def format_task(self, args):
        uuid, task = args
        custom_format_task = self.application.options.format_task

        if custom_format_task:
            task = custom_format_task(copy.copy(task))
        return uuid, task


class TasksView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        capp = self.application.capp

        time = 'natural-time' if app.options.natural_time else 'time'
        if capp.conf.CELERY_TIMEZONE:
            time += '-' + capp.conf.CELERY_TIMEZONE

        self.render(
            "tasks.html",
            tasks=[],
            columns=app.options.tasks_columns,
            time=time,
        )