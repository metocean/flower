import os

from scheduler.core import rediscover_config, DISCOVERED_ACTIONS
from scheduler.settings import LOGDIR, ACTIONS_DIR
import tailer

def get_action_conf(action_id):
    if action_id is None:
        return None, None
    rediscover_config(action_id, 'DISCOVERED_ACTIONS', ACTIONS_DIR)
    if action_id in DISCOVERED_ACTIONS:
        with open(DISCOVERED_ACTIONS[action_id]) as conf:
            config = conf.read()
            template_config = None
            for line in config.splitlines():
                if 'template: ' in line:
                    template = line.split(':')[-1].strip()
                    template_config, _ = get_action_conf(template)

            return config, template_config
    else:
        return None, None

def get_log(logpath, lines=1000):
    if os.path.exists(logpath):
        with open(logpath) as log:
            logfile = os.linesep.join(tailer.tail(log, lines))
    else:
        logfile = None
        logpath = None

    return logfile, logpath