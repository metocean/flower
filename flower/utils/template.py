from __future__ import absolute_import

import re
import sys

PY2 = sys.version_info[0] == 2
if not PY2:
    text_type = str
    string_types = (str,)
else:
    text_type = unicode
    string_types = (str, unicode)

from datetime import datetime, timedelta

KEYWORDS_UP = ('ssl', 'uri', 'url', 'uuid', 'eta')
KEYWORDS_DOWN = ('args', 'kwargs')
UUID_REGEX = re.compile(r'^[\w]{8}(-[\w]{4}){3}-[\w]{12}$')


def format_time(time):
    dt = datetime.fromtimestamp(time)
    return '%s' % (
        dt.strftime("%d-%m-%Y %H:%M:%S"))

def format_progress(progress):
    return progress*100

def seconds_to_timedelta(time):
    dt = timedelta(seconds=round(time)) if isinstance(time, (int,float)) else '-'
    return '%s' % dt

def humanize(obj, type=None, length=None):
    if obj is None:
        obj = ''
    elif type == 'time':
        try:
            obj = format_time(float(obj)) if obj else '-'
        except ValueError:
            pass
    elif isinstance(obj, string_types) and not re.match(UUID_REGEX, obj):
        obj = obj.replace('-', ' ').replace('_', ' ')
        obj = re.sub('|'.join(KEYWORDS_UP),
                     lambda m: m.group(0).upper(), obj)
        if obj and obj not in KEYWORDS_DOWN:
            obj = obj[0].upper() + obj[1:]
    elif isinstance(obj, list):
        if all(isinstance(x, (int, float) + string_types) for x in obj):
            obj = ', '.join(map(str, obj))
    if length is not None and len(obj) > length:
        obj = obj[:length - 4] + ' ...'
    return obj
