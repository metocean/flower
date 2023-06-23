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
from .tasks import TasksDataTable

logger = logging.getLogger(__name__)



class CyclesView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        capp = self.application.capp

        time = 'natural-time' if app.options.natural_time else 'time'
        if capp.conf.CELERY_TIMEZONE:
            time += '-' + capp.conf.CELERY_TIMEZONE
        columns = 'action_id,cycle_dt,state,received,eta,started,timestamp,runtime,worker,routing_key,retries'
        self.render(
            "cycles.html",
            tasks=[],
            columns=columns,
            time=time,
        )

class CyclesDataTable(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        draw = self.get_argument('draw', type=int)
        start = self.get_argument('start', type=int)
        length = self.get_argument('length', type=int)
        search = self.get_argument('search[value]', type=str)

        #column = self.get_argument('order[0][column]', type=int)
        #sort_by = self.get_argument('columns[%s][data]' % column, type=str)
        #sort_order = self.get_argument('order[0][dir]', type=str) == 'asc'
        sort_order=1
        sort_by='name'

        tasks = sorted(iter_tasks(app.events, search=search),
                       key=lambda x: getattr(x[1], sort_by),
                       reverse=sort_order)
        tasks = list(map(self.format_task, tasks))
        filtered_tasks = []
        i = 0
        cycle_tasks = ['tasks.WrapperTask',
                       'tasks.PythonTask',
                       'tasks.SubprocessTask',
                       'chain.AllocateChainTask',
                       'chain.GroupChainTask']
        for _, task in tasks:
            if i < start:
                i += 1
                continue
            if i >= (start + length):
                break
            task = as_dict(task)
            if task['name'] not in cycle_tasks:
                i += 1
                continue
            task['worker'] = task['worker'].hostname
            try:
                kwargs = ast.literal_eval(task['kwargs'])
            except:
                i += 1
                continue
            task['action_id'] = kwargs.get('action_id', 'null')
            task['cycle_dt'] = kwargs.get('cycle_dt', 'null')
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