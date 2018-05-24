import os

from scheduler.core import discover_configs
from scheduler.settings import LOGDIR, ACTIONS_DIR
import tailer

def get_action_conf(action_id):
    actions = discover_configs(ACTIONS_DIR)
    if actions.has_key(action_id):
        with open(actions[action_id]) as conf:
            action_conf = conf.read()
    else:
        action_conf = None
    
    return action_conf

def get_logfile(basedir, logname, lines=1000):
    logdir = os.path.join(LOGDIR, basedir)
    logpath = os.path.join(logdir, '%s.log' % logname)
    if os.path.exists(logpath):
        with open(logpath) as log:
            logfile = os.linesep.join(tailer.tail(log, lines))
    else:
        logfile = None
        logpath = None

    return logfile, logpath