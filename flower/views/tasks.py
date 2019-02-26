from functools import total_ordering
from __future__ import absolute_import

import sys
import copy
import logging
import ast
import json
import os
import celery


from tornado import web

from ..views import BaseHandler
from ..utils.tasks import iter_tasks, get_task_by_id, as_dict, get_states
from ..utils.actions import get_action_conf, get_log

from scheduler.core import get_action_logfile, get_cycle_logfile

logger = logging.getLogger(__name__)


class TaskView(BaseHandler):

    @web.authenticated
    def get(self, task_id):
        task = get_task_by_id(self.application.events, task_id)

        capp = self.application.capp
        if capp.conf.CELERY_TIMEZONE:
            tz = capp.conf.CELERY_TIMEZONE
        else:
            tz = 'UTC'

        if task is None:
            raise web.HTTPError(404, "Unknown task '%s'" % task_id)

        if task.action_id and task.cycle_dt:
            logfile, logpath = get_log(get_action_logfile(task.action_id, 
                                                          task.cycle_dt))
        elif task.name and task.name.startswith('cycle.'):
            logfile, logpath = get_log(get_cycle_logfile(task_id))
        else:
            logfile, logpath = None, None

        child_tasks = iter_tasks(self.application.events,parent=[task_id],
                                 sort_by='received')

        action_conf, template_conf = get_action_conf(task.template or task.action_id)

        if task.parent:
            parent_task = get_task_by_id(self.application.events, task.parent)
        else:
            parent_task = None

        self.render("task.html", task=task,
                                 action_conf=action_conf,
                                 template_conf=template_conf,
                                 logfile=logfile,
                                 logpath=logpath,
                                 cycle_dt=task.cycle_dt,
                                 parent_task=parent_task,
                                 child_tasks=child_tasks,
                                 tz=tz)


@total_ordering
class Comparable(object):
    """
    Compare two objects, one or more of which may be None.  If one of the
    values is None, the other will be deemed greater.
    """

    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        return self.value == other.value

    def __lt__(self, other):
        try:
            return self.value < other.value
        except TypeError:
            return self.value is None


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
        sort_order = self.get_argument('order[0][dir]', type=str) == 'desc'

        task_type = self.get_argument('task_type', type=str)
        state = self.get_argument('state', type=str)
        
        def key(item):
            val = getattr(item[1], sort_by)
            if sys.version_info[0] == 3:
                val = str(val)
            return val

        tasks = sorted(iter_tasks(app.events, search=search, type=task_type,
                                  state=state),
                       key=key, reverse=sort_order)
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

        self.maybe_normalize_for_sort(app.events.state.tasks_by_timestamp(), sort_by)

        sorted_tasks = sorted(
            iter_tasks(app.events, search=search),
            key=key,
            reverse=sort_order
        )

        filtered_tasks = []

        for task in sorted_tasks[start:start + length]:
            task_dict = as_dict(self.format_task(task)[1])
            if task_dict.get('worker'):
                task_dict['worker'] = task_dict['worker'].hostname

            filtered_tasks.append(task_dict)
            if task['worker']:
                task['worker'] = task['worker'].hostname
            filtered_tasks.append(task)
            i += 1

        self.write(dict(draw=draw, data=filtered_tasks,
                        recordsTotal=len(sorted_tasks),
                        recordsFiltered=len(sorted_tasks)))

    @classmethod
    def maybe_normalize_for_sort(cls, tasks, sort_by):
        sort_keys = {'name': str, 'state': str, 'received': float, 'started': float, 'runtime': float}
        if sort_by in sort_keys:
            for _, task in tasks:
                attr_value = getattr(task, sort_by, None)
                if attr_value:
                    try:
                        setattr(task, sort_by, sort_keys[sort_by](attr_value))
                    except TypeError:
                        pass

    @web.authenticated
    def post(self):
        return self.get()

    def format_task(self, args):
        uuid, task = args
        custom_format_task = self.application.options.format_task

        if custom_format_task:
            try:
                task = custom_format_task(copy.copy(task))
            except Exception:
                logger.exception("Failed to format '%s' task", uuid)
        return uuid, task


class TasksView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        capp = self.application.capp

        time = 'natural-time' if app.options.natural_time else 'time'
        if capp.conf.CELERY_TIMEZONE:
            time += '-' + str(capp.conf.CELERY_TIMEZONE)

        task_types = [t for t in capp.tasks.keys() if t.split('.')[0] in\
             ['allocate', 'chain', 'wrappers','cycle'] or\
             t == 'celery.backend_cleanup']

        self.render(
            "tasks.html",
            tasks=[],
            columns=app.options.tasks_columns,
            time=time,
<<<<<<< HEAD
        )
=======
            task_types=sorted(task_types),
            states=get_states(),
        )
>>>>>>> 8ca7ee0 (Added state and task type selectors to Tasks page and refactor a bit)
