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
    return datetime.datetime.now()+delta+countdown

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
        action_ids = []
        for action_id, vals in actions.items():
            action_ids.append(action_id)
            cron = vals['schedule']['crontab']
            countdown = vals['schedule'].get('countdown', 0)
            nr = get_crontab_next_run(cron, countdown) 
            task = {'action_id': action_id,
                    'crontab': crontab(**cron),
                    'next_run': time.mktime(nr.timetuple()),
                    'countdown': countdown}
            crontab_actions.append(task)

        crontab_actions.sort(key=itemgetter('action_id'))

        columns = 'action_id,cycle_dt,state,received,eta,started,timestamp,runtime'

        self.render(
            "crontab.html",
            tasks=[],
            columns=columns,
            time=flower_time,
            crontab_actions=crontab_actions,
            action_ids = ",".join(action_ids),
        )



class CrontabDataTable(BaseHandler):
    
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
        actions = self.get_argument('actions', type=list)
        
        tasks = sorted(iter_tasks(app.events, search=search, actions=actions),
                       key=lambda x: getattr(x[1], sort_by),
                       reverse=sort_order)

        filtered_tasks = []
        i = 0
        for _, task in tasks:
            if i < start:
                i += 1
                continue
            if i >= (start + length):
                break
            task = as_dict(task)

            if task['worker']:
                task['worker'] = task['worker'].hostname
            filtered_tasks.append(task)
            i += 1
        
        self.write(dict(draw=draw, data=filtered_tasks,
                        recordsTotal=len(tasks),
                        recordsFiltered=len(filtered_tasks)))