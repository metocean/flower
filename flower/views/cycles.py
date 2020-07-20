from __future__ import absolute_import

import copy
import logging
import ast
from operator import itemgetter

try:
    from itertools import imap
except ImportError:
    imap = map

from tornado import web

from ..views import BaseHandler
from ..utils.tasks import iter_tasks, get_task_by_id, as_dict, get_states
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
        columns = 'action_id,cycle_dt,state,received,eta,started,timestamp,runtime,worker,routing_key,retries,expires'
        cycle_tasks = sorted(iter_tasks(app.events, type='cycle.CycleTask'), key=lambda x: x[1].cycle_dt, reverse=True)

        self.render(
            "cycles.html",
            tasks=[],
            columns=columns,
            cycle_tasks = cycle_tasks,
            selected='',
            time=time,
            states=get_states(),
        )

class CyclesDataTable(BaseHandler):

    def _get_cycles(self, selected):
        seleted_cycle_tasks = []
        if selected == 'none':
            seleted_cycle_tasks.append(None)
        else:
            tasks = sorted(iter_tasks(self.application.events, type='cycle.CycleTask'))
            for uuid, task in tasks:
                kwargs = ast.literal_eval(str(getattr(task, 'kwargs', {}))) or {}
                if selected == 'active'  and task.state in ['STARTED', 'RUNNING','RETRY']:
                    seleted_cycle_tasks.append(uuid)
                elif selected == 'previous' and task.state not in ['STARTED','RUNNING','RETRY']:
                    seleted_cycle_tasks.append(uuid)
                elif selected == 'all': 
                    seleted_cycle_tasks.append(uuid)
                elif selected == uuid:
                    seleted_cycle_tasks.append(uuid)
        return seleted_cycle_tasks

    def _squash_allocation(self, selected_cycles, state, search):
        alloc_tasks = list(map(self.format_task, iter_tasks(self.application.events,
                                                search=search, 
                                                state=state,
                                                type=['chain.AllocateChainTask'],
                                                parent=selected_cycles)))

        alloc_uuid = [uuid for uuid,task in alloc_tasks if task.name=='chain.AllocateChainTask']

        wrapper_tasks = ['wrappers.WrapperTask',
                         'wrappers.SubprocessTask',
                         'chain.GroupChainTask']

        other_tasks = list(map(self.format_task, iter_tasks(self.application.events,
                                                 search=search, 
                                                 state=state,
                                                 type=wrapper_tasks,
                                                 parent=alloc_uuid+selected_cycles)))
        for uuid, task in other_tasks+alloc_tasks:
            if task.name == 'chain.AllocateChainTask' and task.state in \
            ['RUNNING', 'SUCCESS']:
                continue
            elif getattr(task, 'parent', None) in alloc_uuid and task.state == 'FAILURE':
                continue
            else:
                yield task

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
        selected = self.get_argument('selected', type=str, default='all')
        state = self.get_argument('state', type=str, default='')
        
        selected_cycles = self._get_cycles(selected)

        if not selected_cycles:
            self.write(dict(draw=draw, data=[],
                            recordsTotal=0,
                            recordsFiltered=0))
            return
            
        filtered_tasks = []
        i = 0
        for task in self._squash_allocation(selected_cycles, state, search):
            task = as_dict(task)
            task['worker'] = getattr(task.get('worker',None),'hostname',None)
            if i < start:
                i += 1
                continue
            if i >= (start + length):
                break
            
            filtered_tasks.append(task)
            i += 1

        filtered_tasks = sorted(filtered_tasks, key=lambda x: x.get(sort_by), 
                                reverse=sort_order)

        self.write(dict(draw=draw, data=filtered_tasks,
                            recordsTotal=len(filtered_tasks),
                            recordsFiltered=len(filtered_tasks)))

    def format_task(self, task):
        uuid, task = task
        custom_format_task = self.application.options.format_task

        if custom_format_task:
            task = custom_format_task(copy.copy(task))
        return uuid, task