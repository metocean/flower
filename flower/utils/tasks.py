from __future__ import absolute_import

import datetime
import time
import ast
import celery
import six

from .search import satisfies_search_terms, parse_search_terms
from celery.events.state import Task

def iter_tasks(events, limit=None, type=None, worker=None, state=None,
               sort_by=None, received_start=None, received_end=None,
               started_start=None, started_end=None, search=None,
               parent=[], actions=[]):
    i = 0
    tasks = events.state.tasks_by_timestamp()
    if sort_by is not None:
        tasks = sort_tasks(tasks, sort_by)
    convert = lambda x: time.mktime(
        datetime.datetime.strptime(x, '%Y-%m-%d %H:%M').timetuple()
    )
    search_terms = parse_search_terms(search or {})
    for uuid, task in tasks:
        task = expand_kwargs(task)

        if parent and getattr(task,'parent',None) not in parent:
            continue
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

        if not task.kwargs:
            task.kwargs = {}
        
        if actions and task.action_id not in actions:
            continue

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
        return expand_kwargs(events.state.tasks.get(task_id))
    else:
        _fields = Task._defaults.keys()
        task = events.state.tasks.get(task_id)
        if task is not None:
            task._fields = _fields
        return expand_kwargs(task)


def get_states():
    states = set(celery.states.ALL_STATES)
    states.update({'ALLOCATING','SENT','RUNNING'})
    return sorted(list(states))

def as_dict(task):
    # as_dict is new in Celery 3.1.7
    if hasattr(Task, 'as_dict'):
        action_id = getattr(task, 'action_id', None)
        cycle_dt = getattr(task, 'cycle_dt', None)
        parent = getattr(task, 'parent', None)
        result = task.as_dict()
        result.update(dict(action_id=action_id,cycle_dt=cycle_dt,parent=parent))
        return result
    # old version
    else:
        return task.info(fields=task._defaults.keys())

def to_python(val, _type=None):
    if isinstance(val, six.string_types):
        try:
            return ast.literal_eval(val)
        except:
            return val        
    elif (_type and isinstance(val, _type)) or (val and _type is None):
        return val
    elif val == None and _type:
        return _type()
    else:
        return None


def expand_kwargs(task):
    if task is not None:
        task.kwargs = to_python(task.kwargs, dict)
        task.args = to_python(task.args, list)
        task.result = to_python(task.result)
        task.action_id = task.kwargs.get('action_id', None)
        task.cycle_dt = task.kwargs.get('cycle_dt', None)
        task.end_cycle_dt = task.kwargs.get('end_cycle_dt', None)
        task.parent = task.kwargs.get('parent', None)
        ensemble_template = task.kwargs.get('ensemble', {}).get('template',None)
        task.template = task.kwargs.get('template', ensemble_template)
        task.workflows_id = task.kwargs.get('workflows_id', [])
        task.actions_id = task.kwargs.get('actions_id', [])
        if not hasattr(task, 'memory'):
            task.memory = {'limit':0,'usage':0}
        if isinstance(task.result, dict) and 'memory_usage' in task.result:
            task.memory = {
                'limit': task.result.get('memory_limit', 0),
                'usage': task.result.get('memory_usage', 0)}
    return task