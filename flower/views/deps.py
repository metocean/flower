from __future__ import absolute_import

import sys
import copy
import logging
import ast
import os
import shelve

try:
    from itertools import imap
except ImportError:
    imap = map

from tornado import web
from ..views import BaseHandler

from scheduler.command.__main__ import SchedulerCommand
from scheduler.utils import gen_deps_tree

class DependencyImageView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        workflow = self.get_argument('workflow', type=str)

        output = '/tmp/%s.png' % task_id
        if not os.path.exists(output):
            try:
                command = SchedulerCommand(['deps','-w', workflow,
                                            '-o', output])
                command.run()
            except SystemExit as exc:
                if exc.code == 0:
                    pass
                else:
                    raise Exception('Deps graph failed to generate due')

        self.set_header("Content-Type", "image/png")
        with open(output) as dep_plot:
            self.write(dep_plot.read())


class DependencySankeyView(BaseHandler):
    @web.authenticated
    def get(self, task_id):
        app = self.application
        capp = self.application.capp
        workflow = self.get_argument('workflow', type=str)
        tree = gen_deps_tree(workflow.split(','))
        cache = shelve.open('/tmp/sankey_cache.shelve')
        task_id = str(task_id)
        if cache.has_key(task_id):
            table = cache[task_id]
        else:
            table = []    
            for action_id, deps in tree.items():
                row = []
                for dep_id in deps['hard']:
                    row.append([action_id,dep_id,1,'true','hard'])
                for dep_id in deps['soft']:
                    row.append([action_id,dep_id,0.1,'false','soft'])
                table.extend(row)
            cache[task_id] = table
        cache.close()
        self.render('deps.html', table=table)