
var flower = (function () {
    "use strict";
    /*jslint browser: true */
    /*jslint unparam: true, node: true */
    /*global $, WebSocket, jQuery, Rickshaw */

    function on_alert_close(event) {
        event.preventDefault();
        event.stopPropagation();
        $(event.target).parent().hide();
    }

    function show_error_alert(message) {
        $("#alert").removeClass("alert-success").addClass("alert-error");
        $("#alert-message").html("<strong>Error!</strong>    " + message);
        $("#alert").show();
    }

    function show_success_alert(message) {
        $("#alert").removeClass("alert-error").addClass("alert-success");
        $("#alert-message").html("<strong>Success!</strong>    " + message);
        $("#alert").show();
    }

    function get_selected_workers() {
        var table = $('#workers-table').DataTable();
        return $.map(table.rows('.selected').data(), function (row) {
            return row.name;
        });
    }


    function render_status(data, type, full, meta) {
        switch (data) {
        case 'SUCCESS':
            return '<span class="label label-success">' + data + '</span>';
        case 'FAILURE':
            return '<span class="label label-important">' + data + '</span>';
        case 'REVOKED':
            return '<span class="label label-important">' + data + '</span>';
        case 'RUNNING':
            if (full.result && full.result.hasOwnProperty('progress')){
                var progress = full.result.progress * 100,
                    status = '- ' + full.result.status;
                return '<div class="progress"><div class="bar" style="width: '+progress+'%;">'+progress.toFixed(1)+'% '+status+'</div>'
            } else {
            return '<span class="label label-info">' + data + '</span>';
            }
        case 'STARTED':
            return '<span class="label label-info">' + data + '</span>';
        case 'ALLOCATING':
            return '<span class="label label-queued">' + data + '</span>';
        case 'RETRY':
            return '<span class="label label-warning">' + data + '</span>';
        default:
            return '<span class="label label-default">' + data + '</span>';
        }
    }

    function format_duration(data) {
        if (data) {
            var d = moment.duration({seconds:data});
            if (d.days() > 0) {
                return d.format('D[d] HH:mm:ss', { trim: false })
            } else {
                return d.format('hh:mm:ss', { trim: false })
            }
        } else { return data }
        
    }    

    function url_prefix() {
        var url_prefix = $('#url_prefix').val();
        if (url_prefix) {
            return '/' + url_prefix;
        }
        return '';
    }

    function shutdown_selected(event) {
        var selected_workers = get_selected_workers();
        if (selected_workers.length === 0) {
            show_error_alert('Please select a worker');
            return;
        }

        $.each(selected_workers, function (index, worker) {
            $.ajax({
                type: 'POST',
                url: url_prefix() + '/api/worker/shutdown/' + worker,
                dataType: 'json',
                data: {
                    workername: worker
                },
                success: function (data) {
                    show_success_alert(data.message);
                },
                error: function (data) {
                    show_error_alert(data.responseText);
                }
            });
        });
    }

    function restart_selected(event) {
        var selected_workers = get_selected_workers();
        if (selected_workers.length === 0) {
            show_error_alert('Please select a worker');
            return;
        }

        $.each(selected_workers, function (index, worker) {

            $.ajax({
                type: 'POST',
                url: url_prefix() + '/api/worker/pool/restart/' + worker,
                dataType: 'json',
                data: {
                    workername: worker
                },
                success: function (data) {
                    show_success_alert(data.message);
                },
                error: function (data) {
                    show_error_alert(data.responseText);
                }
            });
        });
    }

    function refresh_selected(event) {
        var selected_workers = get_selected_workers();

        if (!selected_workers.length) {
            $.ajax({
                type: 'GET',
                url: url_prefix() + '/api/workers',
                data: {
                    refresh: 1
                },
                success: function (data) {
                    show_success_alert('Refreshed');
                },
                error: function (data) {
                    show_error_alert(data.responseText);
                }
            });
        }

        $.each(selected_workers, function (index, worker) {
            $.ajax({
                type: 'GET',
                url: url_prefix() + '/api/workers',
                dataType: 'json',
                data: {
                    workername: unescape(worker),
                    refresh: 1
                },
                success: function (data) {
                    show_success_alert(data.message || 'Refreshed');
                },
                error: function (data) {
                    show_error_alert(data.responseText);
                }
            });
        });
    }

    function on_worker_refresh(event) {
        event.preventDefault();
        event.stopPropagation();

        $.ajax({
            type: 'GET',
            url: window.location.pathname,
            data: 'refresh=1',
            success: function (data) {
                //show_success_alert('Refreshed');
                window.location.reload();
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_pool_grow(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            grow_size = $('#pool-size option:selected').html();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/pool/grow/' + workername,
            dataType: 'json',
            data: {
                'workername': workername,
                'n': grow_size,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_pool_shrink(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            shrink_size = $('#pool-size option:selected').html();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/pool/shrink/' + workername,
            dataType: 'json',
            data: {
                'workername': workername,
                'n': shrink_size,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_pool_autoscale(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            min = $('#min-autoscale').val(),
            max = $('#max-autoscale').val();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/pool/autoscale/' + workername,
            dataType: 'json',
            data: {
                'workername': workername,
                'min': min,
                'max': max,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_add_consumer(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            queue = $('#add-consumer-name').val();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/queue/add-consumer/' + workername,
            dataType: 'json',
            data: {
                'workername': workername,
                'queue': queue,
            },
            success: function (data) {
                show_success_alert(data.message);
                setTimeout(function () {
                    $('#tab-queues').load('/worker/' + workername + ' #tab-queues').fadeIn('show');
                }, 10000);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_cancel_consumer(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            queue = $(event.target).closest("tr").children("td:eq(0)").text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/queue/cancel-consumer/' + workername,
            dataType: 'json',
            data: {
                'workername': workername,
                'queue': queue,
            },
            success: function (data) {
                show_success_alert(data.message);
                setTimeout(function () {
                    $('#tab-queues').load('/worker/' + workername + ' #tab-queues').fadeIn('show');
                }, 10000);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_task_timeout(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            taskname = $(event.target).closest("tr").children("td:eq(0)").text(),
            timeout = $(event.target).siblings().closest("input").val();

        taskname = taskname.split(' ')[0]; // removes [rate_limit=xxx]

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/timeout/' + taskname,
            dataType: 'json',
            data: {
                'workername': workername,
                'type': timeout,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_task_rate_limit(event) {
        event.preventDefault();
        event.stopPropagation();

        var workername = $('#workername').text(),
            taskname = $(event.target).closest("tr").children("td:eq(0)").text(),
            ratelimit = $(event.target).prev().val();

        taskname = taskname.split(' ')[0]; // removes [rate_limit=xxx]

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/rate-limit/' + taskname,
            dataType: 'json',
            data: {
                'workername': workername,
                'ratelimit': ratelimit,
            },
            success: function (data) {
                show_success_alert(data.message);
                setTimeout(function () {
                    $('#tab-limits').load('/worker/' + workername + ' #tab-limits').fadeIn('show');
                }, 10000);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_task_revoke(event) {
        event.preventDefault();
        event.stopPropagation();

        var taskid = $('#taskid').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/revoke/' + taskid,
            dataType: 'json',
            data: {
                'terminate': false,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_task_terminate(event) {
        event.preventDefault();
        event.stopPropagation();

        var taskid = $('#taskid').text(),
            destination = $('#worker').children('td:eq(1)').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/terminate/' + taskid,
            dataType: 'json',
            data: {
                'destination': destination,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {
                show_error_alert(data.responseText);
            }
        });
    }

    function on_task_retry(event) {
        event.preventDefault();
        event.stopPropagation();

        var task_id = $('#uuid').children('td:eq(1)').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/retry/' + task_id,
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {    
                show_error_alert(data.responseText);
            }
        });
    }

    function update_row_data(rowdata, update){
        var rowdata = rowdata;
        rowdata.timestamp = update.timestamp
        rowdata.worker = update.hostname
        if (update.type == "task-succeeded") {
            rowdata.state = "SUCCESS"
        } else if (update.type == "task-failed"){
            rowdata.state = "FAILURE"
        } else if (update.type == "task-retried"){
            rowdata.state = "RETRY"
        } else {
            rowdata.state = update.type.split('-')[1].toUpperCase()
        }
        if (update.hasOwnProperty('result')) {
            rowdata.result = update.result;
        }
        if (update.hasOwnProperty('args')) {
            rowdata.args = update.args;
        }
        if (update.hasOwnProperty('kwargs')) {
            rowdata.kwargs = update.kwargs;
        }
        if (update.hasOwnProperty('runtime')) {
            rowdata.runtime = update.runtime;
        }
        if (update.hasOwnProperty('name')) {
            rowdata.name = update.name;
        }
        if (update.hasOwnProperty('eta')) {
            rowdata.eta = update.eta;
        }
        if (update.hasOwnProperty('retries')) {
            rowdata.retries = update.retries;
        }
        if (update.hasOwnProperty('routing_key')) {
            rowdata.routing_key = update.routing_key;
        }

        return rowdata
    }

    function update_table_data(update, table) {
        if ((update.type == 'task-received') && 
             ((Date.now() - window.last_draw) > 10000 )) {
            table.draw();
            window.last_draw = Date.now();
        } else {
            var row = table.row('#'+update.uuid);
            if (row.data()) {
                var rowdata = row.data();    
                rowdata = update_row_data(rowdata, update);     
                row.data(rowdata);
                collapse_collapsable();
            }
        }
    }   

    function on_cancel_task_filter(event) {
        event.preventDefault();
        event.stopPropagation();

        $('#task-filter-form').each(function () {
            $(this).find('SELECT').val('');
            $(this).find('.datetimepicker').val('');
        });

        $('#task-filter-form').submit();
    }

    function format_time(timestamp) {
        if (timestamp) {
            var time = $('#time').val(),
                prefix = time.startsWith('natural-time') ? 'natural-time' : 'time',
                tz = time.substr(prefix.length + 1) || 'UTC';

            if (prefix === 'natural-time') {
                return moment.unix(timestamp).tz(tz).fromNow();
            }
            return moment.unix(timestamp).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        } else {
            return timestamp
        }
    }

    function format_isotime(timestamp) {
        console.log(timestamp)
        if (timestamp) {
            var time = $('#time').val(),
                prefix = time.startsWith('natural-time') ? 'natural-time' : 'time',
                tz = time.substr(prefix.length + 1) || 'UTC';

            if (prefix === 'natural-time') {
                return moment(timestamp).tz(tz).fromNow();
            }
            return moment(timestamp).tz(tz).format('YYYY-MM-DD HH:mm:ss');
        } else { return timestamp }
    }

    function isColumnVisible(name) {
        var columns = $('#columns').val();
        if (columns) {
            columns = columns.split(',').map(function (e) {
                return e.trim();
            });
            return columns.indexOf(name) !== -1;
        }
        return true;
    }

    $.urlParam = function (name) {
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        return (results && results[1]) || 0;
    };

    function update_progress(container, update){
        var progress = update.result['progress']*100,
            state = update.result['status'];
    
        if (container.children('.progress').length == 0) {
            container.text("");
            var pbar = container.prepend('<div class="progress"></div>').children(),
                bar = pbar.append('<div class="bar" style="width:'+ 
                                             progress + '%"'+state+'></div>').children();
            if (state) {
                bar.text(progress.toFixed(1)+'% - '+state);
            } else {
                bar.text(progress.toFixed(1)+'%');
            }
        } else {
            var bar = container.children('.progress').children('.bar');
            bar.css('width', progress+'%');
            if (state) {
                bar.text(progress.toFixed(1)+'% - '+state);
            } else {
                bar.text(progress.toFixed(1)+'%');
            }
        }
    }

    function toTitleCase(str) {
        return str.replace(/(?:^|\s)\w/g, function(match) {
            return match.toUpperCase();
        });
    }      

    $(document).ready(function () {
        //https://github.com/twitter/bootstrap/issues/1768
        var shiftWindow = function () {
            scrollBy(0, -50);
        };
        if (location.hash) {
            shiftWindow();
        }
        window.addEventListener("hashchange", shiftWindow);

        // Make bootstrap tabs persistent
        $(document).ready(function () {
            if (location.hash !== '') {
                $('a[href="' + location.hash + '"]').tab('show');
            }

            $('a[data-toggle="tab"]').on('shown', function (e) {
                location.hash = $(e.target).attr('href').substr(1);
            });
        });
        window.last_draw = Date.now();

    });

    return {
        shutdown_selected: shutdown_selected,
        restart_selected: restart_selected,
        refresh_selected: refresh_selected,
        on_alert_close: on_alert_close,
        on_worker_refresh: on_worker_refresh,
        on_pool_grow: on_pool_grow,
        on_pool_shrink: on_pool_shrink,
        on_pool_autoscale: on_pool_autoscale,
        on_add_consumer: on_add_consumer,
        on_cancel_consumer: on_cancel_consumer,
        on_task_timeout: on_task_timeout,
        on_task_rate_limit: on_task_rate_limit,
        on_cancel_task_filter: on_cancel_task_filter,
        on_task_revoke: on_task_revoke,
        on_task_terminate: on_task_terminate,
        on_task_retry: on_task_retry,
        update_table_data: update_table_data,
        render_status: render_status,
        format_time: format_time,
        format_isotime: format_isotime,
        format_duration: format_duration,
        isColumnVisible: isColumnVisible,
        url_prefix: url_prefix,
    };

}(jQuery));
