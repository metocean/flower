from __future__ import absolute_import

import datetime
import time
import ast

from .search import satisfies_search_terms, parse_search_terms

from celery.events.state import Task

fields = list(Task._fields)
fields.extend(['cycle_dt', 'action_id'])
Task._fields = tuple(fields)

def iter_tasks(events, limit=None, type=None, worker=None, state=None,
               sort_by=None, received_start=None, received_end=None,
               started_start=None, started_end=None, search=None,
               actions=[]):
    i = 0
    tasks = events.state.tasks_by_timestamp()
    if sort_by is not None:
        tasks = sort_tasks(tasks, sort_by)
    convert = lambda x: time.mktime(
        datetime.datetime.strptime(x, '%Y-%m-%d %H:%M').timetuple()
    )
    search_terms = parse_search_terms(search or {})

    for uuid, task in tasks:
        if type and task.name and task.name not in type:
            continue
        if worker and task.worker and task.worker.hostname != worker:
            continue
        if state and task.state != state:
            continue
        if received_start and task.received and\
                task.received < convert(received_start):
            continue
        if received_end and task.received and\
                task.received > convert(received_end):
            continue
        if started_start and task.started and\
                task.started < convert(started_start):
            continue
        if started_end and task.started and\
                task.started > convert(started_end):
            continue

        if not satisfies_search_terms(task, search_terms):
            continue

        task.kwargs = ast.literal_eval(task.kwargs) if not isinstance(task.kwargs, dict) else task.kwargs

        if task.kwargs:
            task.action_id = task.kwargs.get('action_id', None)
            task.cycle_dt = task.kwargs.get('cycle_dt', None)
        else:
            task.cycle_dt = None
            task.action_id = None

        if actions and task.action_id not in actions:
            continue 

        task.kwargs = str(task.kwargs)

        yield uuid, task
        i += 1
        if i == limit:
            break


sort_keys = {'name': str, 'state': str, 'received': float, 'started': float}


def sort_tasks(tasks, sort_by):
    assert sort_by.lstrip('-') in sort_keys
    reverse = False
    if sort_by.startswith('-'):
        sort_by = sort_by.lstrip('-')
        reverse = True
    for task in sorted(
            tasks,
            key=lambda x: getattr(x[1], sort_by) or sort_keys[sort_by](),
            reverse=reverse):
        yield task


def get_task_by_id(events, task_id):
    if hasattr(Task, '_fields'):  # Old version
        return events.state.tasks.get(task_id)
    else:
        _fields = Task._defaults.keys()
        task = events.state.tasks.get(task_id)
        if task is not None:
            task._fields = _fields
        return task


def as_dict(task):
    # as_dict is new in Celery 3.1.7
    if hasattr(Task, 'as_dict'):
        return task.as_dict()
    # old version
    else:
        return task.info(fields=task._defaults.keys())
