import os

from scheduler.core import discover_actions
from scheduler.settings import LOGDIR
import tailer

def get_action_conf(action_id):
    actions = discover_actions()
    if actions.has_key(action_id):
        with open(actions[action_id]) as conf:
            action_conf = conf.read()
    else:
        action_conf = None
    
    return action_conf

def get_logfile(action_id):
    logdir = os.path.join(LOGDIR, 'actions')
    logpath = os.path.join(logdir, '%s.log' % action_id)
    if os.path.exists(logpath):
        with open(logpath) as log:
            logfile = os.linesep.join(tailer.tail(log, 500))
    else:
        logfile = None
        logpath = None

    return logfile, logpath