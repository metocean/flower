import datetime
import time
import ast

from .search import satisfies_search_terms, parse_search_terms

from celery.events.state import Task

fields = list(Task._fields)
fields.extend(['cycle_dt', 'action_id'])
Task._fields = tuple(fields)

def iter_tasks(events, limit=None, offset=0, type=None, worker=None, state=None,
               sort_by=None, received_start=None, received_end=None,
               started_start=None, started_end=None, search=None,
               actions=[]):
    i = 0
    tasks = events.state.tasks_by_timestamp()
    if sort_by is not None:
        tasks = sort_tasks(tasks, sort_by)

    def convert(x):
        return time.mktime(datetime.datetime.strptime(x, '%Y-%m-%d %H:%M').timetuple())

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

        if not task.kwargs:
            task.kwargs = {}
        
        task = expand_kwargs(task)

        if actions and task.action_id not in actions:
            continue

        yield uuid, task
        i += 1
        if limit != None:
            if i == limit + offset:
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


def expand_kwargs(task):
    if task is not None:
        if isinstance(task.kwargs,(str, unicode)):
            task.kwargs = ast.literal_eval(task.kwargs)        
        elif isinstance(task.kwargs, dict):
            pass
        else:
            task.kwargs = {}
        task.action_id = task.kwargs.get('action_id', None)
        task.cycle_dt = task.kwargs.get('cycle_dt', None)
        task.parent = task.kwargs.get('parent', None)
        task.workflow = task.kwargs.get('workflow', None)
        task.template = task.kwargs.get('template', None)
    return task