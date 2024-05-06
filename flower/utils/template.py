import os
import re
import json
from datetime import datetime
from datetime import timedelta
import six
from celery import current_app
import dateutil.parser as dparser

try:
    from urllib import urlencode
except ImportError:
    from urllib.parse import urlencode

from humanize import naturaltime
from pytz import timezone, utc



KEYWORDS_UP = ('ssl', 'uri', 'url', 'uuid', 'eta')
KEYWORDS_DOWN = ('args', 'kwargs')
UUID_REGEX = re.compile(r'^[\w]{8}(-[\w]{4}){3}-[\w]{12}$')

def format_time(time, tz):
    """
    Formats a given timestamp into a string representation of date and time in the specified timezone.

    Args:
        time (float): The timestamp to be formatted.
        tz (timezone): The timezone to use for formatting.

    Returns:
        str: The formatted string representation of the timestamp in the specified timezone.
    """
    dt = datetime.fromtimestamp(time, tz=tz)
    return dt.strftime("%Y-%m-%d %H:%M:%S %Z")

def format_isotime(time):
    """
    Formats the given time string into a specific format.

    Args:
        time (str): The time string to be formatted.

    Returns:
        str: The formatted time string in the format "%Y-%m-%d %H:%M:%S %Z".
    """
    dt = dparser.parse(time)
    return dt.strftime("%Y-%m-%d %H:%M:%S %Z")

format_progress = lambda x: x*100

def sched_app():
    """
    Get the title of the scheduler application.

    Returns:
        str: The title of the scheduler application.
    """
    title = os.getenv("SCHEDULER_APPLICATION", "development")
    return title.title()

def docs_url():
    """
    Returns the URL for the scheduler documentation.

    If the environment variable 'SCHEDULER_DOCS_URL' is set, it will be used as the URL.
    Otherwise, the default URL '/docs' will be returned.

    Returns:
        str: The URL for the scheduler documentation.
    """
    return os.getenv('SCHEDULER_DOCS_URL') or '/docs'

def smart_truncate(content, length=100, suffix='...'):
    """
    Truncates the given content to the specified length and appends a suffix if necessary.

    Args:
        content (str): The content to be truncated.
        length (int, optional): The maximum length of the truncated content. Defaults to 100.
        suffix (str, optional): The suffix to be appended if the content is truncated. Defaults to '...'.

    Returns:
        str: The truncated content.

    """
    content = str(content)
    if len(content) <= length:
        return content
    else:
        return content[:length].rsplit(' ', 1)[0]+suffix

def to_json(content):
    """
    Convert the given content to a JSON string.

    Args:
        content: The content to be converted.

    Returns:
        A JSON string representation of the content.

    Raises:
        None.
    """
    try:
        return json.dumps(content)
    except:
        return json.dumps(str(content))

def humanize(obj, type=None, length=None):
    """
    Convert the given object into a human-readable format based on the specified type.

    Args:
        obj: The object to be humanized.
        type: The type of humanization to be applied. Possible values are 'time', 'isotime', 'natural-time'.
        length: The maximum length of the humanized object.

    Returns:
        The humanized object.

    """
    if obj is None:
        obj = ''
    elif type and type.startswith('time'):
        tz = type[len('time'):].lstrip('-')
        tz = timezone(tz) if tz else getattr(current_app, 'timezone', '') or utc
        obj = format_time(float(obj), tz) if obj else ''
    elif type and type.startswith('isotime'):
        obj = format_isotime(obj) if obj else ''
    elif type and type.startswith('natural-time'):
        tz = type[len('natural-time'):].lstrip('-')
        tz = timezone(tz) if tz else getattr(current_app, 'timezone', '') or utc
        delta = datetime.now(tz) - datetime.fromtimestamp(float(obj), tz)
        if delta < timedelta(days=1):
            obj = naturaltime(delta)
        else:
            obj = format_time(float(obj), tz) if obj else ''
    elif isinstance(obj, six.string_types) and not re.match(UUID_REGEX, obj):
        obj = obj.replace('-', ' ').replace('_', ' ')
        obj = re.sub('|'.join(KEYWORDS_UP),
                     lambda m: m.group(0).upper(), obj)
        if obj and obj not in KEYWORDS_DOWN:
            obj = obj[0].upper() + obj[1:]
    elif isinstance(obj, list):
        if all(isinstance(x, (int, float) + six.string_types) for x in obj):
            obj = ', '.join(map(str, obj))
    if length is not None and len(obj) > length:
        obj = obj[:length - 4] + ' ...'
    return obj
