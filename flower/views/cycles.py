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
        cycles_tasks = sorted(iter_tasks(app.events, type='cycle.CycleTask'))
        cycles = []
        for uuid, task in cycles_tasks:
            if not isinstance(task.kwargs, dict):
                task.kwargs = ast.literal_eval(task.kwargs)
            cycle = task.kwargs.get('cycle_dt')
            if cycle not in cycles:
                cycles.append(cycle)
        cycles.sort(reverse=True)

        self.render(
            "cycles.html",
            tasks=[],
            columns=columns,
            cycles_dt = cycles,
            cycle_dt=cycles[0] if cycles else '',
            time=time,
        )

class CyclesDataTable(BaseHandler):
    @web.authenticated
    def get(self):
        try:
            app = self.application
            draw = self.get_argument('draw', type=int)
            start = self.get_argument('start', type=int)
            length = self.get_argument('length', type=int)
            search = self.get_argument('search[value]', type=str)

            column = self.get_argument('order[0][column]', type=int)
            sort_by = self.get_argument('columns[%s][data]' % column, type=str)
            sort_order = self.get_argument('order[0][dir]', type=str) == 'asc'
            cycle_dt = self.get_argument('cycle_dt', type=str)

            tasks = sorted(iter_tasks(app.events, search=search),
                           key=lambda x: getattr(x[1], sort_by),
                           reverse=sort_order)

            tasks = list(map(self.format_task, tasks))
            cycle_tasks = ['tasks.WrapperTask',
                           'tasks.PythonTask',
                           'tasks.SubprocessTask',
                           'chain.AllocateChainTask',
                           'chain.GroupChainTask']

            filtered_tasks = []
            i = 0
            for _, task in tasks:
                if i < start:
                    i += 1
                    continue
                if i >= (start + length):
                    break
                task = as_dict(task)
                try:
                    kwargs = ast.literal_eval(task.get('kwargs'))
                    task['cycle_dt'] = kwargs.get('cycle_dt')
                    task['action_id'] = kwargs.get('action_id')
                    if cycle_dt and task['cycle_dt'] != cycle_dt:
                        continue
                except :
                    continue
                task['worker'] = task['worker'].hostname
                filtered_tasks.append(task)
                i += 1

            self.write(dict(draw=draw, data=filtered_tasks,
                            recordsTotal=len(filtered_tasks),
                            recordsFiltered=len(filtered_tasks)))
        except Exception:
            import traceback, StringIO, os
            exc_buffer = StringIO.StringIO()
            traceback.print_exc(file=exc_buffer)
            print exc_buffer.getvalue()

    def format_task(self, args):
        uuid, task = args
        custom_format_task = self.application.options.format_task

        if custom_format_task:
            task = custom_format_task(copy.copy(task))
        return uuid, task