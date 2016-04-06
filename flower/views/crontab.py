from __future__ import absolute_import

import copy
import logging
import ast
import datetime
import time
import pytz
from operator import itemgetter

try:
    from itertools import imap
except ImportError:
    imap = map

from tornado import web
from celery.schedules import crontab

from ..views import BaseHandler
from ..utils.tasks import iter_tasks, get_task_by_id, as_dict
from .tasks import TasksDataTable

from scheduler.flow import CrontabFlow

logger = logging.getLogger(__name__)

def get_crontab_next_run(cron, countdown=0):
    delta = crontab(**cron).remaining_estimate(datetime.datetime.utcnow())
    countdown = datetime.timedelta(seconds=countdown)
    return datetime.datetime.utcnow()+delta+countdown

class CrontabView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        capp = self.application.capp

        flower_time = 'natural-time' if app.options.natural_time else 'time'
        if capp.conf.CELERY_TIMEZONE:
            flower_time += '-' + capp.conf.CELERY_TIMEZONE

        actions = CrontabFlow().crontab_actions

        crontab_actions = []
        for action_id, vals in actions.items():
            cron = vals['schedule']['crontab']
            countdown = vals['schedule'].get('countdown', 0)
            nr = get_crontab_next_run(cron, countdown) 
            task = {'action_id': action_id,
                    'crontab': crontab(**cron),
                    'next_run': time.mktime(nr.timetuple())}
            crontab_actions.append(task)

        crontab_actions.sort(key=itemgetter('action_id'))

        columns = 'action_id,cycle_dt,state,received,eta,started,timestamp,runtime,next_run'

        self.render(
            "crontab.html",
            tasks=[],
            columns=columns,
            time=flower_time,
            crontab_actions=crontab_actions,
        )



class CrontabDataTable(BaseHandler):
    
    def _get_crontab_next_run(self, cron, countdown):
        delta = crontab(**cron).remaining_estimate(datetime.datetime.utcnow())
        return (datetime.datetime.now()+delta).replace(tzinfo=pytz.UTC)

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

        actions = CrontabFlow().crontab_actions

        crontab_tasks = []
        for _, task in tasks:

            task = as_dict(task)

            kwargs = ast.literal_eval(str(task.get('kwargs')))
            if kwargs:
                task['action_id'] = kwargs.get('action_id', None)
            else:
                continue

            if task['action_id']  not in actions.keys():
                continue

            task['cycle_dt'] = kwargs.get('cycle_dt', None)
            task['worker'] = getattr(task.get('worker',None),'hostname',None)

            cron = actions[task['action_id']]['schedule']['crontab']
            countdown = actions[task['action_id']]['schedule'].get('countdown', 0)

            if task.get('started', None):
                nr = self._get_crontab_next_run(cron, countdown)
                task['next_run'] = time.mktime(nr.timetuple())
            else:
                task['next_run'] = task.eta

            crontab_tasks.append(task)


        filtered_tasks = []
        i = 0
        for task in crontab_tasks:
            if i < start:
                i += 1
                continue
            if i >= (start + length):
                break                    

            filtered_tasks.append(task)
            i += 1
        
        self.write(dict(draw=draw, data=filtered_tasks,
                        recordsTotal=len(crontab_tasks),
                        recordsFiltered=len(crontab_tasks)))