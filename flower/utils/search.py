import re

from kombu.utils.encoding import safe_str


def parse_search_terms(raw_search_value):
    """
    Parses the raw search value and returns a dictionary containing the parsed search terms.

    Args:
        raw_search_value (str): The raw search value to be parsed.

    Returns:
        dict: A dictionary containing the parsed search terms. The keys in the dictionary
              represent different search categories, such as 'result', 'args', 'kwargs', and 'state'.
              The values associated with each key are the corresponding parsed search values.

    Example:
        >>> parse_search_terms('result:success args:1 kwargs=foo=bar state:running')
        {'result': 'success', 'args': ['1'], 'kwargs': {'foo': 'bar'}, 'state': ['running']}
    """
    search_regexp = r'(?:[^\s,"]|"(?:\\.|[^"])*")+'  # splits by space, ignores space in quotes
    if not raw_search_value:
        return {}
    parsed_search = {}
    for query_part in re.findall(search_regexp, raw_search_value):
        if not query_part:
            continue
        if query_part.startswith('result:'):
            parsed_search['result'] = preprocess_search_value(query_part[len('result:'):])
        elif query_part.startswith('args:'):
            if 'args' not in parsed_search:
                parsed_search['args'] = []
            parsed_search['args'].append(preprocess_search_value(query_part[len('args:'):]))
        elif query_part.startswith('kwargs:'):
            if 'kwargs'not in parsed_search:
                parsed_search['kwargs'] = {}
            try:
                key, value = [p.strip() for p in query_part[len('kwargs:'):].split('=')]
            except ValueError:
                continue
            parsed_search['kwargs'][key] = preprocess_search_value(value)
        elif query_part.startswith('state'):
            if 'state' not in parsed_search:
                parsed_search['state'] = []
            parsed_search['state'].append(preprocess_search_value(query_part[len('state:'):]))
        else:
            parsed_search['any'] = preprocess_search_value(query_part)
    return parsed_search


def satisfies_search_terms(task, search_terms):
    """
    Check if a task satisfies the given search terms.

    Args:
        task (Task): The task to be checked.
        search_terms (dict): A dictionary containing the search terms.

    Returns:
        bool: True if the task satisfies the search terms, False otherwise.
    """
    any_value_search_term = search_terms.get('any')
    result_search_term = search_terms.get('result')
    args_search_terms = search_terms.get('args')
    kwargs_search_terms = search_terms.get('kwargs')
    state_search_terms = search_terms.get('state')

    if not any([any_value_search_term,
                result_search_term,
                args_search_terms, 
                kwargs_search_terms,
                state_search_terms]):
        return True
    
    terms = [
        state_search_terms and task.state in state_search_terms,
        any_value_search_term and any_value_search_term in '|'.join(map(str,
            filter(None, [task.name, task.uuid, task.state,
                          task.worker.hostname if task.worker else None,
                          task.args, task.kwargs, safe_str(task.result)]))),
        result_search_term and task.result and result_search_term in task.result,
        kwargs_search_terms and all(
            stringified_dict_contains_value(k, v, str(task.kwargs)) for k, v in kwargs_search_terms.items()
        ),
        args_search_terms and task_args_contains_search_args(task.args, args_search_terms)
    ]
    return any(terms)


def stringified_dict_contains_value(key, value, str_dict):
    """Checks if dict in for of string like "{'test': 5}" contains
    key/value pair. This works faster, then creating actual dict
    from string since this operation is called for each task in case
    of kwargs search."""
    if not str_dict:
        return False
    value = str(value)
    try:
        # + 3 for key right quote, one for colon and one for space
        key_index = str_dict.index(key) + len(key) + 3
    except ValueError:
        return False
    try:
        comma_index = str_dict.index(',', key_index)
    except ValueError:
        # last value in dict
        comma_index = str_dict.index('}', key_index)
    return str(value) == str_dict[key_index:comma_index].strip('"\'')


def preprocess_search_value(raw_value):
    """
    Preprocesses the search value by removing leading and trailing double quotes and spaces.

    Args:
        raw_value (str): The raw search value.

    Returns:
        str: The preprocessed search value.
    """
    return raw_value.strip('" ') if raw_value else ''


def task_args_contains_search_args(task_args, search_args):
    """
    Check if the given task arguments contain all the search arguments.

    Args:
        task_args (list): The task arguments to search in.
        search_args (list): The search arguments to check for.

    Returns:
        bool: True if all search arguments are present in the task arguments, False otherwise.
    """
    if not task_args:
        return False
    return all(a in task_args for a in search_args)
