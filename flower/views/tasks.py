from __future__ import absolute_import

import datetime
import time
import pytz
import ast
import celery
import tailer
from celery.schedules import crontab
from celery.result import AsyncResult

from tornado import web

from ..views import BaseHandler
from ..models import TaskModel, WorkersModel, ActionModel, CycleModel

from scheduler.flow import CrontabFlow

class TaskView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        #import pdb; pdb.set_trace()
        task = TaskModel.get_task_by_id(self.application, task_id)
        if task is None:
            raise web.HTTPError(404, "Unknown task '%s'" % task_id)
            
        #result = self.application.celery_app.backend.get_result(task_id)
        task.kwargs = ast.literal_eval(str(task.kwargs))
        if task.kwargs:

            cycle_dt = task.kwargs['cycle_dt'] if \
                                         task.kwargs.has_key('cycle_dt') and \
                                         task.kwargs['cycle_dt'] else None

            if task.kwargs.has_key('action_id'):
                action_id = task.kwargs['action_id']
                action_conf = ActionModel.get_action_conf(action_id)
                logfile, logpath = ActionModel.get_log_file(action_id)
                workflow = None
            elif task.kwargs.has_key('workflow'):
                logfile, logpath = CycleModel.get_log_file(cycle_dt)
                workflow = task.kwargs['workflow']
                action_id = None
                action_conf = None
            else:
                action_id = None
                action_conf = None
                routing_key=None
                workflow = None
                logfile, logpath = None

            routing_key = task.kwargs['routing_key'] if \
                                    task.kwargs.has_key('routing_key') else None
        else:
            action_id = None
            action_conf = None
            cycle_dt=None
            routing_key=None
            workflow = None
            logfile, logpath = None

        self.render("task.html", task=task, 
                                 action_id=action_id,
                                 action_conf=action_conf,
                                 workflow=workflow,
                                 logfile=logfile,
                                 logpath=logpath,
                                 cycle_dt=cycle_dt,
                                 routing_key=routing_key)

class ActionView(BaseHandler):
    @web.authenticated
    def get(self, action_id):
        action_path = ActionModel.get_action_conf(action_id)
        logfile = ActionModel.get_log_file(action_id)
        self.render("actions.html", action_id=action_id,
                                    action_path=action_path,
                                    logfile=logfile)

class CycleView(BaseHandler):
    @web.authenticated
    def get(self, cycle):
        logfile = CycleModel.get_log_file(cycle)
        self.render("cycle.html", cycle=action_id,
                                  workflow=workflow,
                                  logfile=logfile)

class TasksView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        limit = self.get_argument('limit', default=None, type=int)
        worker = self.get_argument('worker', None)
        type = self.get_argument('type', None)
        state = self.get_argument('state', None)
        meta = self.get_argument('meta', None)

        worker = worker if worker != 'All' else None
        type = type if type != 'All' else None
        state = state if state != 'All' else None

        tasks = TaskModel.iter_tasks(app, limit=limit, type=type,
                                     worker=worker, state=state)
        workers = WorkersModel.get_workers(app)
        seen_task_types = TaskModel.seen_task_types(app)

        self.render("tasks.html", tasks=tasks,
                    task_types=seen_task_types,
                    all_states=celery.states.ALL_STATES.union({'RUNNING'}),
                    workers=workers,
                    limit=limit,
                    worker=worker,
                    type=type,
                    state=state)

class CyclesView(BaseHandler):
    @web.authenticated
    def get(self):
        app = self.application
        cycle_tag = app.celery_app.conf.CYCLE_DATETIME_PATTERN
        limit = self.get_argument('limit', default=None, type=int)
        worker = self.get_argument('worker', None)
        type_ = self.get_argument('type', None)
        state = self.get_argument('state', None)
        meta = self.get_argument('meta', None)
        cycle_state = self.get_argument('cycle_state', 'SUCCESS')
        action_type = self.get_argument('action_type', None)
        cycle_dt = self.get_argument('cycle_dt', None)
        action_type = action_type if action_type != 'All' else None
        cycle_dt = cycle_dt if cycle_dt != 'All' else None
        worker = worker if worker != 'All' else None
        type_ = type_ if type_ != 'All' else None
        state = state if state != 'All' else None

        cycles = TaskModel.iter_tasks(app, 
                                     limit=limit, 
                                     type='cycle.CycleTask',
                                     worker=worker, 
                                     state=cycle_state)

        cycle_tasks = []
        workflow = []
        cycles_dts = []
        for uuid,task in cycles:
            cycle = task.kwargs['cycle_dt']
            if cycle_dt and cycle != cycle_dt:
                continue
            for action_id in task.kwargs['workflow']:
                if action_id not in workflow:
                    workflow.append(action_id)
            cycle_tasks.append((cycle, uuid, task))
        
        if action_type:
            all_types = []
            for action_id in workflow:
                if action_type in action_id:
                    all_types.append(action_id)
        else:
            all_types = workflow
        all_types.sort()
        workflow = workflow if not type_ else [type_]
        cycle_tasks.sort()
        cycle_tasks.reverse()
        cyclic_tasks = TaskModel.iter_tasks(app, limit=limit, 
                                     type=['tasks.WrapperTask',
                                           'tasks.PythonTask',
                                           'tasks.SubprocessTask'
                                           'chain.AllocateChainTask',
                                           'chain.ChainGroupTask'],
                                     worker=worker, 
                                     state=state, 
                                     actions=workflow,
                                     action_type=action_type,
                                     cycles=[c[0] for c in cycle_tasks])

        workers = WorkersModel.get_workers(app)
        workers.sort()
        action_type = action_type if action_type != None else 'All'

        self.render("cycles.html", 
                    tasks=cyclic_tasks,
                    task_types=all_types,
                    action_type=action_type,
                    cycles_tasks=cycle_tasks,
                    cycle_state=cycle_state,
                    cycle_dt=cycle_dt,
                    all_states=celery.states.ALL_STATES,
                    workers=workers,
                    limit=limit,
                    worker=worker,
                    type=type_,
                    state=state)

class CrontabView(BaseHandler):
    def _get_crontab_next_run(self, cron):
        delta = crontab(**cron).remaining_estimate(datetime.datetime.utcnow())
        return datetime.datetime.utcnow()+delta

    @web.authenticated
    def get(self):
        app = self.application
        cycle_tag = app.celery_app.conf.CYCLE_DATETIME_PATTERN
        limit = self.get_argument('limit', default=None, type=int)
        worker = self.get_argument('worker', None)
        type_ = self.get_argument('type', None)
        state = self.get_argument('state', None)
        meta = self.get_argument('meta', None)
        crontab_state = self.get_argument('crontab_state', None)
        action_type = self.get_argument('action_type', None)
        action_id = self.get_argument('action_id', None)

        action_type = action_type if action_type != 'All' else None
        action_id = action_id if action_id != 'All' else None
        crontab_state = crontab_state if crontab_state != 'All' else None
        worker = worker if worker != 'All' else None
        type_ = type_ if type_ != 'All' else None
        state = state if state != 'All' else None

        cronflow = CrontabFlow()

        if action_id:
            crontab_actions = [action_id]
        else:
            crontab_actions = cronflow.crontab_actions.keys()

        crontab_tasks = TaskModel.iter_tasks(app, limit=limit,
                                     type=type_,
                                     worker=worker,
                                     state=crontab_state or state,
                                     actions=crontab_actions,
                                     action_type=action_type)

        crontasks = []
        if crontab_state:
            for uuid, task in crontab_tasks:
                if task.kwargs and task.kwargs.has_key('action_id'):
                    a_id = task.kwargs['action_id']
                    cron = cronflow.crontab_actions[a_id]['schedule']['crontab']
                    task.crontab = crontab(**cron)
                    if task.started:
                        nr = self._get_crontab_next_run(cron)
                        task.next_run = time.mktime(nr.timetuple())
                    else:
                        task.next_run = task.eta
                    crontasks.append((uuid,task))
        else:
            for action_id, vals in cronflow.crontab_actions.items():
                cron = vals['schedule']['crontab']
                nr = self._get_crontab_next_run(cron) 
                task = {'action_id': action_id,
                        'crontab': crontab(**cron),
                        'next_run': time.mktime(nr.timetuple())}
                crontasks.append(task)

        workers = WorkersModel.get_workers(app)
        workers.sort()
        crontab_actions.sort()
        action_type = action_type if action_type != None else 'All'
        
        self.render("crontab.html",
                    tasks=crontasks,
                    crontab_actions=crontab_actions,
                    action_type=action_type,
                    action_id=action_id,
                    crontab_state=crontab_state,
                    all_states=celery.states.ALL_STATES,
                    workers=workers,
                    limit=limit,
                    worker=worker,
                    type=type_,
                    state=state)

