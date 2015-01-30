from __future__ import absolute_import

from tornado import web
from celery import states

from ..views import BaseHandler

class SphinxViewer(BaseHandler):
    @web.authenticated
    def get(self):
        self.render("docs.html")