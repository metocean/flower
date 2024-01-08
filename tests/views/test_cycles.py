import os
import json
import time

from celery.events import Event
from celery.utils import uuid

from flower.events import EventsState
from .unit import AsyncHTTPTestCase
from .unit.utils import cycle_task, task_succeeded_events, task_running_events, task_failed_events


class CycleTest(AsyncHTTPTestCase):

    def setUp(self):
        self.app = super(CycleTest, self).get_app()
        super(CycleTest, self).setUp()

    def get_app(self):
        return self.app

    def test_no_cycles(self):
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertTrue('UUID' in str(r.body))
        self.assertNotIn('<tr id=', str(r.body))
    
    def test_dependencies_graph(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        task_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=task_id, 
                                  workflow=['default'])
        events.extend(cycle_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        resp = self.get('/pydot/%s' % task_id)
        self.assertEqual(200, resp.code)
        self.assertEqual(resp.headers['Content-Type'], 'image/png')
        self.assertTrue(os.path.exists('/tmp/%s.png'%task_id))

    def test_running_cycle(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        task_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=task_id)
        events.extend(cycle_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+task_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10)
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

    def test_success_cycle(self):
        worker = 'headworker1'
        task_id = uuid()
        state = EventsState()
        state.get_or_create_worker(worker)
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'SUCCESS', id=task_id)
        events.extend(cycle_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+task_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10)
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

    def test_failed_cycle(self):
        worker = 'headworker1'
        task_id = uuid()
        state = EventsState()
        state.get_or_create_worker(worker)
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'FAILURE', id=task_id)
        events.extend(cycle_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+task_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10)
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

    def test_running_cycle_with_children(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        cycle_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=cycle_id)
        child_id = uuid()
        child_task_events = task_succeeded_events(worker, child_id, 
                                                  'wrappers.WrapperTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':cycle_id})
        events.extend(cycle_events)
        events.extend(child_task_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+cycle_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10, selected='previous')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

        params = dict(draw=1, start=0, length=10, selected='active')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(1, table['recordsTotal'])

        tasks = table['data']
        self.assertEqual('SUCCESS', tasks[0]['state'])
        self.assertEqual('wrappers.WrapperTask', tasks[0]['name'])
        self.assertEqual(child_id, tasks[0]['uuid'])
        self.assertEqual(worker, tasks[0]['worker'])

    def test_running_cycle_with_children_subprocess(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        cycle_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=cycle_id)
        child_id = uuid()
        child_task_events = task_succeeded_events(worker, child_id, 
                                                  'wrappers.SubprocessTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':cycle_id})
        events.extend(cycle_events)
        events.extend(child_task_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+cycle_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10, selected='previous')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

        params = dict(draw=1, start=0, length=10, selected='active')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(1, table['recordsTotal'])

        tasks = table['data']
        self.assertEqual('SUCCESS', tasks[0]['state'])
        self.assertEqual('wrappers.SubprocessTask', tasks[0]['name'])
        self.assertEqual(child_id, tasks[0]['uuid'])
        self.assertEqual(worker, tasks[0]['worker'])


    def test_running_cycle_with_children_allocate_chain_running(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        cycle_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=cycle_id)
        child_id = uuid()
        child_task_events = task_running_events(worker, child_id, 
                                                  'chain.AllocateChainTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':cycle_id})
        chain_child_id = uuid()
        child_task_events += task_running_events(worker, chain_child_id, 
                                                  'wrappers.WrapperTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':child_id})
        events.extend(cycle_events)
        events.extend(child_task_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+cycle_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10, selected='previous')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

        params = dict(draw=1, start=0, length=10, selected='active')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(1, table['recordsTotal'])

        tasks = table['data']
        self.assertEqual('RUNNING', tasks[0]['state'])
        self.assertEqual('wrappers.WrapperTask', tasks[0]['name'])
        self.assertEqual(chain_child_id, tasks[0]['uuid'])
        self.assertEqual(worker, tasks[0]['worker'])

    def test_running_cycle_with_children_allocate_chain_succeed(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        cycle_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=cycle_id)
        child_id = uuid()
        child_task_events = task_succeeded_events(worker, child_id, 
                                                  'chain.AllocateChainTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':cycle_id})
        chain_child_id = uuid()
        child_task_events += task_succeeded_events(worker, chain_child_id, 
                                                  'wrappers.WrapperTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':child_id})
        events.extend(cycle_events)
        events.extend(child_task_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+cycle_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10, selected='previous')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

        params = dict(draw=1, start=0, length=10, selected='active')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(1, table['recordsTotal'])

        tasks = table['data']
        self.assertEqual('SUCCESS', tasks[0]['state'])
        self.assertEqual('wrappers.WrapperTask', tasks[0]['name'])
        self.assertEqual(chain_child_id, tasks[0]['uuid'])
        self.assertEqual(worker, tasks[0]['worker'])

    def test_running_cycle_with_children_allocate_chain_failed(self):
        worker = 'headworker1'
        state = EventsState()
        state.get_or_create_worker(worker)
        cycle_id = uuid()
        events = [Event('worker-online', hostname=worker)]
        cycle = '20000101_0000z'
        cycle_events = cycle_task(worker, cycle, 'RUNNING', id=cycle_id)
        child_id = uuid()
        child_task_events = task_failed_events(worker, child_id, 
                                                  'chain.AllocateChainTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':cycle_id})
        chain_child_id = uuid()
        child_task_events += task_failed_events(worker, chain_child_id, 
                                                  'wrappers.WrapperTask', 
                                                  kwargs={'action_id':'test_action',
                                                          'cycle_dt': cycle,
                                                          'parent':child_id})
        events.extend(cycle_events)
        events.extend(child_task_events)
        for i, e in enumerate(events):
            e['clock'] = i
            e['local_received'] = time.time()
            state.event(e)
        self.app.events.state = state
        r = self.get('/cycles')
        self.assertEqual(200, r.code)
        self.assertIn('/task/'+cycle_id, r.body.decode("utf-8"))

        params = dict(draw=1, start=0, length=10, selected='previous')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(0, table['recordsTotal'])

        params = dict(draw=1, start=0, length=10, selected='active')
        params['search[value]'] = ''
        params['order[0][column]'] = 0
        params['columns[0][data]'] = 'name'
        params['order[0][dir]'] = 'asc'

        r = self.get('/cycles/datatable?' + '&'.join(
                    map(lambda x: '%s=%s' % x, params.items())))

        table = json.loads(r.body.decode("utf-8"))
        self.assertEqual(200, r.code)
        self.assertEqual(1, table['recordsTotal'])

        tasks = table['data']
        self.assertEqual('FAILURE', tasks[0]['state'])
        self.assertEqual('chain.AllocateChainTask', tasks[0]['name'])
        self.assertEqual(child_id, tasks[0]['uuid'])
        self.assertEqual(worker, tasks[0]['worker'])