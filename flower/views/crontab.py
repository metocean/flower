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

import tornado
from tornado import web
from tornado.concurrent import run_on_executor

from celery.schedules import crontab

from ..views import BaseHandler
from ..utils.tasks import iter_tasks, get_task_by_id, as_dict
from .tasks import TasksDataTable

from scheduler.beat import SchedulerBeat

logger = logging.getLogger(__name__)

def get_crontab_next_run(cron, countdown=0):
    delta = crontab(**cron).remaining_estimate(datetime.datetime.utcnow())
    countdown = datetime.timedelta(seconds=countdown)
    return datetime.datetime.now()+delta+countdown

class CrontabView(BaseHandler):
    def __init__(self, *args, **kwargs):
        super(CrontabView, self).__init__(*args,**kwargs)
        self.pool = self.application.pool
    
    @run_on_executor(executor='pool')
    def _get_crontab_actions(self):
        actions = SchedulerBeat().crontab_actions
        crontab_actions = []
        action_ids = []
        for action_id in sorted(actions.keys()):
            action_ids.append(action_id)
            cron = actions[action_id]['schedule']['crontab']
            countdown = actions[action_id]['schedule'].get('countdown', 0)
            nr = get_crontab_next_run(cron, countdown) 
            task = {'action_id': action_id,
                    'crontab': crontab(**cron),
                    'next_run': time.mktime(nr.timetuple()),
                    'countdown': countdown}
            action_ids.append(action_id)
            crontab_actions.append(task)
        return crontab_actions, action_ids

    @web.authenticated
    @tornado.gen.coroutine
    def get(self):
        app = self.application
        capp = self.application.capp

        flower_time = 'natural-time' if app.options.natural_time else 'time'
        if capp.conf.CELERY_TIMEZONE:
            flower_time += '-' + capp.conf.CELERY_TIMEZONE

        columns = 'action_id,cycle_dt,state,received,eta,started,timestamp,runtime'
        actions, action_ids = yield self._get_crontab_actions()
        self.render(
            "crontab.html",
            tasks=[],
            columns=columns,
            time=flower_time,
            crontab_actions=actions,
            action_ids=','.join(action_ids)
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
        actions = self.get_argument('actions', type=str).split(',')

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