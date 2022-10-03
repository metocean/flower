from __future__ import absolute_import

import os

from tornado.web import StaticFileHandler, url

from .api import events
from .api import control
from .api import tasks
from .api import workers
from .views import auth
from .views import monitor
from .views.broker import BrokerView
from .views.workers import WorkerView
from .views.tasks import TaskView, TasksView, TasksDataTable
from .views.cycles import CyclesView, CyclesDataTable
from .views.crontab import CrontabView, CrontabDataTable
from .views.error import NotFoundErrorHandler
from .views.dashboard import DashboardView, DashboardUpdateHandler
from .views.tailer import UpdateLogfile
from .views.action import ActionView
from .views.deps import DependencyPydotView
from .utils import gen_cookie_secret


settings = dict(
    template_path=os.path.join(os.path.dirname(__file__), "templates"),
    static_path=os.path.join(os.path.dirname(__file__), "static"),
    cookie_secret=gen_cookie_secret(),
    static_url_prefix='/static/',
    login_url='/login',
)


handlers = [
    # App
    url(r"/", DashboardView, name='main'),
    url(r"/dashboard", DashboardView, name='dashboard'),
    url(r"/worker/(.+)", WorkerView, name='worker'),
    url(r"/task/(.+)", TaskView, name='task'),
    url(r"/pydot/(.+)", DependencyPydotView, name='deps'),
    url(r"/tasks", TasksView, name='tasks'),
    url(r"/cycles", CyclesView, name='cycles'),
    url(r"/cycles/datatable", CyclesDataTable),
    url(r"/tasks/datatable", TasksDataTable),
    url(r"/crontab", CrontabView, name='crontab'),
    url(r"/crontab/datatable", CrontabDataTable),
    url(r"/broker", BrokerView, name='broker'),
    # Worker API
    (r"/api/workers", workers.ListWorkers),
    (r"/api/worker/shutdown/(.+)", control.WorkerShutDown),
    (r"/api/worker/pool/restart/(.+)", control.WorkerPoolRestart),
    (r"/api/worker/pool/grow/(.+)", control.WorkerPoolGrow),
    (r"/api/worker/pool/shrink/(.+)", control.WorkerPoolShrink),
    (r"/api/worker/pool/autoscale/(.+)", control.WorkerPoolAutoscale),
    (r"/api/worker/queue/add-consumer/(.+)", control.WorkerQueueAddConsumer),
    (r"/api/worker/queue/cancel-consumer/(.+)",
        control.WorkerQueueCancelConsumer),
    # Task API
    (r"/api/tasks", tasks.ListTasks),
    (r"/api/task/types", tasks.ListTaskTypes),
    (r"/api/queues/length", tasks.GetQueueLengths),
    (r"/api/task/info/(.*)", tasks.TaskInfo),
    (r"/api/task/apply/(.+)", tasks.TaskApply),
    (r"/api/task/async-apply/(.+)", tasks.TaskAsyncApply),
    (r"/api/task/send-task/(.+)", tasks.TaskSend),
    (r"/api/task/result/(.+)", tasks.TaskResult),
    (r"/api/task/abort/(.+)", tasks.TaskAbort),
    (r"/api/task/timeout/(.+)", control.TaskTimout),
    (r"/api/task/rate-limit/(.+)", control.TaskRateLimit),
    (r"/api/task/revoke/(.+)", control.TaskRevoke),
    (r"/api/task/terminate/(.+)", control.TaskTerminate),
    (r"/api/task/retry/(.+)", control.TaskRetry),
    # Events WebSocket API
    (r"/api/task/events/task-sent/(.*)", events.TaskSent),
    (r"/api/task/events/task-received/(.*)", events.TaskReceived),
    (r"/api/task/events/task-started/(.*)", events.TaskStarted),
    (r"/api/task/events/task-succeeded/(.*)", events.TaskSucceeded),
    (r"/api/task/events/task-failed/(.*)", events.TaskFailed),
    (r"/api/task/events/task-revoked/(.*)", events.TaskRevoked),
    (r"/api/task/events/task-retried/(.*)", events.TaskRetried),
    (r"/api/task/events/task-custom/(.*)", events.TaskCustom),
    (r"/api/task/events/update-tasks/", events.TasksUpdate),
    (r"/api/task/events/update-task/(.*)", events.TasksUpdate),
    # WebSocket Updates
    (r"/update-dashboard", DashboardUpdateHandler),
    (r"/update-logfile/(.*)", UpdateLogfile),
    # Monitors
    url(r"/monitor", monitor.Monitor, name='monitor'),
    (r"/monitor/succeeded-tasks", monitor.SucceededTaskMonitor),
    (r"/monitor/failed-tasks", monitor.FailedTaskMonitor),
    (r"/monitor/completion-time", monitor.TimeToCompletionMonitor),
    (r"/monitor/broker", monitor.BrokerMonitor),
    # Metrics
    (r"/metrics", monitor.Metrics),
    # Static
    (r"/static/(.*)", StaticFileHandler,
     {"path": settings['static_path']}),
    # Auth
    (r"/login", auth.LoginHandler),
    (r"/logout", auth.LogoutHandler),

    # Error
    (r".*", NotFoundErrorHandler),
]
