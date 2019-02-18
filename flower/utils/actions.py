import os

from scheduler import core, settings
import tailer

def get_action_conf(action_id):
    if action_id is None:
        return None, None
    core.rediscover_config(action_id, 'DISCOVERED_ACTIONS', settings.ACTIONS_DIR)
    if action_id in core.DISCOVERED_ACTIONS:
        with open(core.DISCOVERED_ACTIONS[action_id]) as conf:
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