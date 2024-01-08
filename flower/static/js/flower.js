/*jslint browser: true */
/*global $, WebSocket, jQuery */

var flower = (function () {
    "use strict";

    var alertContainer = document.getElementById('alert-container');
    function show_alert(message, type) {
        var wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="alert alert-${type} alert-dismissible" role="alert">
                <div>${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
        alertContainer.appendChild(wrapper);
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
            return '<span class="badge bg-success">' + data + '</span>';
        case 'FAILURE':
            return '<span class="badge bg-danger">' + data + '</span>';
        case 'REVOKED':
            return '<span class="badge bg-important">' + data + '</span>';
        case 'RUNNING':
            if (full.result && full.result.hasOwnProperty('progress')){
                var progress = full.result.progress * 100,
                    status = '- ' + full.result.status;
                return '<div class="progress"><div class="progress-bar" role="progressbar" style="width: '+progress+'%;">'+progress.toFixed(1)+'% '+status+'</div>'
            } else {
            return '<span class="badge bg-info">' + data + '</span>';
            }
        case 'STARTED':
            return '<span class="badge bg-info">' + data + '</span>';
        case 'ALLOCATING':
            return '<span class="badge bg-primary">' + data + '</span>';
        case 'RETRY':
            return '<span class="badge bg-warning">' + data + '</span>';
        default:
            return '<span class="badge bg-secondary">' + data + '</span>';
        }
    }

    function render_collapsable(data, type, full, meta) {
        return '<span class="collapsable">'+data+'</span>'
    }

    function collapse_collapsable () { 
        $('.collapsable').expander({slicePoint: 25,
                                    preserveWords: false,
                                    expandText: '-->',
                                    collapseText: '<--'});
    }

    function format_duration(data, type, full, meta) {
        if (data) {
            var d = moment.duration({seconds:data});
            if (d.days() > 0) {
                return d.format('D[d] HH:mm:ss', { trim: false })
            } else {
                return d.format('hh:mm:ss', { trim: false })
            }
        } else { return data }
        
    }    

    var pprint_json = function pprint_json(object, pre) {
        var text = JSON.stringify(JSON.parse(object.replace(/'/g, '"')),undefined,4);
        if (pre) {
            return '<pre>'+text+'</pre>'
        } else {
            return text
        }
    }

    function url_prefix() {
        var prefix = $('#url_prefix').val();
        if (prefix) {
            prefix = prefix.replace(/\/+$/, '');
            if (prefix.startsWith('/')) {
                return prefix;
            } else {
                return '/' + prefix;
            }
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

    //https://github.com/DataTables/DataTables/blob/1.10.11/media/js/jquery.dataTables.js#L14882
    function htmlEscapeEntities(d) {
        return typeof d === 'string' ?
            d.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') :
            d;
    }

    function active_page(name) {
        var pathname = $(location).attr('pathname');
        if (name === '/') {
            return pathname === (url_prefix() + name);
        }
        else {
            return pathname.startsWith(url_prefix() + name);
        }
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
        $('.dropdown-toggle').dropdown('hide');

        var workername = $('#workername').text();

        $.ajax({
            type: 'GET',
            url: url_prefix() + '/api/workers',
            dataType: 'json',
            data: {
                workername: unescape(workername),
                refresh: 1
            },
            success: function (data) {
                show_alert(data.message || 'Successfully refreshed', 'success');
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    };

    $('#worker-refresh-all').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('.dropdown-toggle').dropdown('hide');

        $.ajax({
            type: 'GET',
            url: url_prefix() + '/api/workers',
            dataType: 'json',
            data: {
                refresh: 1
            },
            success: function (data) {
                show_alert(data.message || 'Refreshed All Workers', 'success');
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-pool-restart').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('.dropdown-toggle').dropdown('hide');

        var workername = $('#workername').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/pool/restart/' + workername,
            dataType: 'json',
            data: {
                workername: workername
            },
            success: function (data) {
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-shutdown').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        $('.dropdown-toggle').dropdown('hide');

        var workername = $('#workername').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/worker/shutdown/' + workername,
            dataType: 'json',
            data: {
                workername: workername
            },
            success: function (data) {
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-pool-grow').on('click', function (event) {
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
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-pool-shrink').on('click', function (event) {
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
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-pool-autoscale').on('click', function (event) {
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
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-add-consumer').on('click', function (event) {
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
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#worker-queues').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!event.target.id.startsWith("worker-cancel-consumer")) {
            return;
        }

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
                show_alert(data.message, "success");
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#limits-table').on('click', function (event) {
        if (event.target.id.startsWith("task-timeout-")) {
            var timeout = parseInt($(event.target).siblings().closest("input").val()),
                type = $(event.target).text().toLowerCase(),
                taskname = $(event.target).closest("tr").children("td:eq(0)").text(),
                post_data = {'workername': $('#workername').text()};

            taskname = taskname.split(' ')[0]; // removes [rate_limit=xxx]
            post_data[type] = timeout;

            if (!Number.isInteger(timeout)) {
                show_alert("Invalid timeout value", "danger");
                return;
            }

            $.ajax({
                type: 'POST',
                url: url_prefix() + '/api/task/timeout/' + taskname,
                dataType: 'json',
                data: post_data,
                success: function (data) {
                    show_alert(data.message, "success");
                },
                error: function (data) {
                    show_alert($(data.responseText).text(), "danger");
                }
            });
        } else if (event.target.id.startsWith("task-rate-limit-")) {
            var taskname = $(event.target).closest("tr").children("td:eq(0)").text(),
                workername = $('#workername').text(),
                ratelimit = parseInt($(event.target).prev().val());

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
                    show_alert(data.message, "success");
                },
                error: function (data) {
                    show_alert(data.responseText, "danger");
                }
            });
        }
    });

    $('#task-revoke').on('click', function (event) {
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
                show_alert(data.message, "success");
                document.getElementById("task-revoke").disabled = true;
                setTimeout(function() {location.reload();}, 5000);
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    $('#task-terminate').on('click', function (event) {
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
                show_alert(data.message, "success");
                document.getElementById("task-terminate").disabled = true;
                setTimeout(function() {location.reload();}, 5000);
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });
    
    $('#task-retry').on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        var taskid = $('#taskid').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/retry/' + taskid,
            dataType: 'json',
            success: function (data) {
                show_alert(data.message, "success");
                document.getElementById("task-retry").disabled = true;
                setTimeout(function() {location.reload();}, 5000);
            },
            error: function (data) {
                show_alert(data.responseText, "danger");
            }
        });
    });

    function sum(a, b) {
        return parseInt(a, 10) + parseInt(b, 10);
    }

    function update_dashboard_counters() {
        var table = $('#workers-table').DataTable();
        $('a#btn-active').text('Active: ' + table.column(2).data().reduce(sum, 0));
        $('a#btn-processed').text('Processed: ' + table.column(3).data().reduce(sum, 0));
        $('a#btn-failed').text('Failed: ' + table.column(4).data().reduce(sum, 0));
        $('a#btn-succeeded').text('Succeeded: ' + table.column(5).data().reduce(sum, 0));
        $('a#btn-retried').text('Retried: ' + table.column(6).data().reduce(sum, 0));
    }

    function on_dashboard_update(update) {
        var table = $('#workers-table').DataTable();

        $.each(update, function (name, info) {
            var row = table.row('#' + name);
            if (row) {
                row.data(info);
            } else {
                table.row.add(info);
            }
        });
        table.draw();

        $('a#btn-active').text('Active: ' + table.column(2).data().reduce(sum, 0));
        $('a#btn-failed').text('Failed: ' + table.column(4).data().reduce(sum, 0));
        $('a#btn-succeeded').text('Succeeded: ' + table.column(5).data().reduce(sum, 0));
        $('a#btn-retried').text('Retried: ' + table.column(6).data().reduce(sum, 0));
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

    function on_tasks_update(update) {
        var table = $('#tasks-table').DataTable();
        update_table_data(update, table);
    }

    function on_cycles_update(update) {
        var table = $('#cycles-table').DataTable(),
            cycles_uuid = $('#cycles-tasks').val().split(',');
            console.log(cycles_uuid);
        if (update.name == 'cycle.CycleTask' ||  $.inArray(update.uuid,cycles_uuid)>-1) { 
            if ($.inArray(update.type, ['task-received','task-succeeded','task-failed']) > -1 ) {
                window.location.reload();
            } else if (update.type == "task-started") {
                var startedcell = $("#"+update.uuid+" td:eq(2)"),
                    timestampcell = $("#"+update.uuid+" td:eq(3)"),
                    workercell = $("#"+update.uuid+" td:eq(4)");
                startedcell.text(format_time(update.timestamp));
                timestampcell.text(format_time(update.timestamp));
                workercell.text(update.hostname);
            } else if (update.type == "task-running") {
                var progresscell = $("#"+update.uuid+" td:eq(3)"),
                    timestampcell = $("#"+update.uuid+" td:eq(5)"),
                    workercell = $("#"+update.uuid+" td:eq(6)");
                    result = update.result || Object()
                update_progress(progresscell, update);
                timestampcell.text(format_time(update.timestamp));
                workercell.text(update.hostname);
            }
        } else {
            update_table_data(update, table);
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
        var time = $('#time').val(),
            prefix = time.startsWith('natural-time') ? 'natural-time' : 'time',
            tz = time.substr(prefix.length + 1) || 'UTC';

        if (prefix === 'natural-time') {
            return moment.unix(timestamp).tz(tz).fromNow();
        }
        return moment.unix(timestamp).tz(tz).format('YYYY-MM-DD HH:mm:ss');
    }

    function format_isotime(timestamp) {
        var time = $('#time').val(),
            prefix = time.startsWith('natural-time') ? 'natural-time' : 'time',
            tz = time.substr(prefix.length + 1) || 'UTC';

        if (prefix === 'natural-time') {
            return moment(timestamp).tz(tz).fromNow();
        }
        return moment(timestamp).tz(tz).format('YYYY-MM-DD HH:mm:ss');
    }

    function isColumnVisible(name) {
        var columns = $('#columns').val();
        if (columns === "all")
            return true;
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

    function logfile_update(update){
        var logheight = $('#logfile')[0].scrollTopMax,
            scrollpos = $('#logfile')[0].scrollTop;
        $('#logfile').append(update);
        if (scrollpos == logheight) {
            $('#logfile').scrollTop($('#logfile')[0].scrollTopMax);
        }
    }

    function connect_tail_socket(logfile) {
        var host = $(location).attr('host'),
            protocol = $(location).attr('protocol') == 'http:' ? 'ws://' : 'wss://';

        var ws = new WebSocket(protocol + host + url_prefix() + '/update-logfile/' + logfile);
        ws.onmessage = function (event) {
                logfile_update(event.data+'<br>');
            };
        $(window).on('beforeunload', function(){
            ws.close()    
        });
    }

    function connect_tasks_socket(update_func) {
        var host = $(location).attr('host'),
            protocol = $(location).attr('protocol') === 'http:' ? 'ws://' : 'wss://',
            ws = new WebSocket(protocol + host + "/api/task/events/update-tasks/");
        ws.onmessage = function (event) {
            var update = $.parseJSON(event.data);
            console.log(update);
            update_func(update);
        };
        console.log(ws);
    }

    function connect_task_socket(update_func, uuid) {
        var host = $(location).attr('host'),
            protocol = $(location).attr('protocol') === 'http:' ? 'ws://' : 'wss://',
            ws = new WebSocket(protocol + host + "/api/task/events/update-task/"+uuid);
        ws.onmessage = function (event) {
            var update = $.parseJSON(event.data);
            console.log(update);
            update_func(update);
        };
    }

    function update_progress(container, result){
        if ('progress' in result) {
            var progress = result['progress']*100,
                state = result['status'];
        
            if (container.children('.progress').length == 0) {
                container.text("");
                var pbar = container.prepend('<div class="progress"></div>').children(),
                    bar = pbar.append('<div class="progress-bar" role="progressbar" style="width:'+ 
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
    }

    function toTitleCase(str) {
        return str.replace(/(?:^|\s)\w/g, function(match) {
            return match.toUpperCase();
        });
    }   

    function add_or_update_field(field, data, after, before){
        if ($("#"+field).length == 0){
            if (after == null) {
                $('#'+before).before('<tr id="'+field+'"><td>'+toTitleCase(field)+'</td><td>'+data+'</td></tr>');
            } else {
                $('#'+after).after('<tr id="'+field+'"><td>'+toTitleCase(field)+'</td><td>'+data+'</td></tr>');
            }

        } else {
            $('#'+field+' td:eq(1)').html(data);
        }
    }


    function on_task_update(update) {
        var timestamp = moment.unix(update.timestamp).utc(),
            tz = $('#tz').text(),
            status = update.type.split('-')[1];
            console.log(status);
        timestamp = timestamp.format("YYYY-MM-DD HH:mm:ss "+tz);
        switch (status){
            case "pending":
                var label = "info",
                    button = "revoke",
                    state = "PENDING";
                break;
            case "sent":
                var label = "default",
                    button = "revoke",
                    state = "SENT";
                add_or_update_field('retries', update.retries, null, 'worker');
                add_or_update_field('sent', timestamp, null, 'started');
                add_or_update_field('routing_key', update.routing_key, null, 'clock');    
            case "received":
                var label = "default",
                    button = "revoke",
                    state = "RECEIVED";
                add_or_update_field('received', timestamp, null, 'sent');
                add_or_update_field('retries', update.retries, null, 'worker');
                add_or_update_field('args', pprint_json(update.args, true), 'state', null);
                add_or_update_field('kwargs', pprint_json(update.kwargs, true), 'args', null);
                add_or_update_field('expires', update.expires, null, 'retries');
                if (update.eta) {
                    add_or_update_field('eta', update.eta, null, 'expires');
                }
                break;
            case "started":
                var label = "info",
                    button = "terminate",
                    state = "STARTED";
                add_or_update_field("started", timestamp, "sent", null);
                break;
            case "running":
                var label = "info",
                    button = "terminate",
                    state = "RUNNING",
                    result =  update.result || Object(),
                    memory_usage = result.memory_usage || 0,
                    memory_limit = result.memory_limit || 0;
                    memory_max = result.memory_max || 0;
                update_progress($('#result td:eq(1)'), result)
                add_or_update_field('memory', memory_usage+ ' / '+memory_max+ ' / '+  memory_limit, 'client', null);
                break;
            case "allocating":
                var label = "queued",
                    button = "terminate",
                    state = "ALLOCATING";
                break;
            case "succeeded":
                var label = "success",
                    button = "retry",
                    state = "SUCCESS";
                add_or_update_field("result", pprint_json(update.result, true), "kwargs", null);
                add_or_update_field("succedded", timestamp, "started", null);
                add_or_update_field("runtime", format_duration(update.runtime), "timestamp", null);
                break;
            case "retried":
                var label = "warning",
                    button = "revoke",
                    state = "RETRY";              
                add_or_update_field("retried", timestamp, "failed", null);
                add_or_update_field("exception", update.exception, null, "timestamp");
                add_or_update_field("traceback", "<pre>"+update.traceback+"</pre>", "timestamp", null);
                break;
            case "revoked":
                var label = "important",
                    button = "retry",
                    state = "REVOKED";
                break;
            case "failed":
                var label = "important",
                    button = "retry",
                    state = "FAILURE";
                add_or_update_field("exception", update.exception, null, "timestamp");
                add_or_update_field("traceback", "<pre>"+update.traceback+"</pre>", "timestamp", null);
                add_or_update_field("failed", timestamp, "started", null);
                break;
            default:
                var label = null,
                    button = null,
                    state = null;
        }
        $('h2 button').remove();
        switch (button) {
            case 'retry':
                if ($.inArray('dedicated', update.hostname)) {
                    $('h2 button').remove();     
                } else {
                    $('h2').append('<button class="btn btn-danger float-end" id="task-retry">Retry</button>');
                }
                break;
            case 'terminate':
               $('h2').append('<button class="btn btn-danger float-end" id="task-terminate">Terminate</button>');
               break;
            case 'revoke':
                $('h2').append('<button class="btn btn-danger float-end" id="task-revoke">Revoke</button>');
                break;
            default:
               $('h2 button').remove();
        }
        if (label) {
            $("#state td:eq(1)").html('<span class="label label-'+label+'">'+state+'</span>');
        }
        $("#clock td:eq(1)").text(update.clock);
        $("#timestamp td:eq(1)").text(timestamp);
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

            // Listen for tab shown events and update the URL hash fragment accordingly
            $('.nav-tabs a[data-bs-toggle="tab"]').on('shown.bs.tab', function (event) {
                const tabPaneId = $(event.target).attr('href').substr(1);
                if (tabPaneId) {
                    window.location.hash = tabPaneId;
                }
            });
        });
    });

    $(document).ready(function () {
        if (!active_page('/') && !active_page('/workers')) {
            return;
        }

        $('#workers-table').DataTable({
            rowId: 'name',
            searching: true,
            select: false,
            paging: true,
            scrollCollapse: true,
            lengthMenu: [15, 30, 50, 100],
            pageLength: 15,
            language: {
                lengthMenu: 'Show _MENU_ workers',
                info: 'Showing _START_ to _END_ of _TOTAL_ workers',
                infoFiltered: '(filtered from _MAX_ total workers)'
            },
            ajax: url_prefix() + '/workers?json=1',
            order: [
                [1, "des"]
            ],
            footerCallback: function( tfoot, data, start, end, display ) {
                var api = this.api();
                var columns = {2:"STARTED", 3:"", 4:"FAILURE", 5:"SUCCESS", 6:"RETRY"};
                for (const [column, state] of Object.entries(columns)) {
                    var total = api.column(column).data().reduce(sum, 0);
                    var footer = total;
                    if (total !== 0) {
                        let queryParams = (state !== '' ? `?state=${state}` : '');
                        footer = '<a href="' + url_prefix() + '/tasks' + queryParams + '">' + total + '</a>';
                    }
                    $(api.column(column).footer()).html(footer);
                }
            },
            columnDefs: [{
                targets: 0,
                data: 'hostname',
                type: 'natural',
                render: function (data, type, full, meta) {
                    return '<a href="' + url_prefix() + '/worker/' + encodeURIComponent(data) + '">' + data + '</a>';
                }
            }, {
                targets: 1,
                data: 'status',
                className: "text-center",
                width: "10%",
                render: function (data, type, full, meta) {
                    if (data) {
                        return '<span class="badge bg-success">Online</span>';
                    } else {
                        return '<span class="badge bg-secondary">Offline</span>';
                    }
                }
            }, {
                targets: 2,
                data: 'active',
                className: "text-center",
                width: "10%",
                defaultContent: 0
            }, {
                targets: 3,
                data: 'task-received',
                className: "text-center",
                width: "10%",
                defaultContent: 0
            }, {
                targets: 4,
                data: 'task-failed',
                className: "text-center",
                width: "10%",
                defaultContent: 0
            }, {
                targets: 5,
                data: 'task-succeeded',
                className: "text-center",
                width: "10%",
                defaultContent: 0
            }, {
                targets: 6,
                data: 'task-retried',
                className: "text-center",
                width: "10%",
                defaultContent: 0
            }, {
                targets: 7,
                data: 'loadavg',
                width: "10%",
                className: "text-center text-nowrap",
                render: function (data, type, full, meta) {
                    if (!full.status) {
                        return 'N/A';
                    }
                    if (Array.isArray(data)) {
                        return data.join(', ');
                    }
                    return data;
                }
            }, ],
        });

        var autorefresh_interval = $.urlParam('autorefresh') || 1;
        if (autorefresh !== 0) {
            setInterval( function () {
                $('#workers-table').DataTable().ajax.reload(null, false);
            }, autorefresh_interval * 1000);
        }

    });
    $(document).ready(function () {
        if (!active_page('/cycles')) {
            return;
        }
        $('#cycles-table').DataTable({
            rowId: 'uuid',
            searching: true,
            paginate: true,
            scrollX: true,
            scrollCollapse: true,
            processing: true,
            serverSide: true,
            colReorder: true,
            lengthMenu: [ 50, 100, 200 ],
            initComplete: function() {
              connect_tasks_socket(on_cycles_update);
            },
            ajax: {
                url: url_prefix() + '/cycles/datatable',
                data: function ( d ) {
                    d.selected = $('#select-cycle option:selected').val();
                    d.state = $('#select-state option:selected').val();
                }   
            },
            order: [
                [6, "asc"]
            ],
            oSearch: {
                "sSearch": $.urlParam('state') ? 'state:' + $.urlParam('state') : ''
            },
            columnDefs: [{
                targets: 0,
                data: 'action_id',
                visible: isColumnVisible('action_id'),
                orderable: true,
                render: function (data, type, full, meta) {
                    return '<a href="' + url_prefix() + '/task/' + full.uuid + '">' + data + '</a>';
                }
            },{
                targets: 1,
                data: 'cycle_dt',
                orderable: true,
                visible: isColumnVisible('cycle_dt')
            }, {
                targets: 2,
                data: 'state',
                visible: isColumnVisible('state'),
                render: render_status
            }, {
                targets: 3,
                data: 'received',
                visible: isColumnVisible('received'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
          
            }, {
                targets: 4,
                data: 'started',
                visible: isColumnVisible('started'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            }, {
                targets: 5,
                data: 'eta',
                visible: isColumnVisible('eta'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_isotime(data);
                    }
                    return data;
                }
            }, {
                targets: 6,
                data: 'timestamp',
                visible: isColumnVisible('timestamp'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            },{
                targets: 7,
                data: 'runtime',
                visible: isColumnVisible('runtime'),
                render: format_duration
            }, {
                targets: 8,
                data: 'worker',
                visible: isColumnVisible('worker')
            }, {
                targets: 9,
                data: 'routing_key',
                visible: isColumnVisible('routing_key')
            }, {
                targets: 10,
                data: 'retries',
                visible: isColumnVisible('retries')
            },{
                targets: 11,
                data: 'expires',
                visible: isColumnVisible('expires'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_isotime(data);
                    }
                    return data;
                }
            },],
        });
        var autorefresh_interval = $.urlParam('autorefresh') || 1;
        if (autorefresh !== 0) {
            setInterval( function () {
                $('#cycles-table').DataTable().ajax.reload(null, false);
            }, autorefresh_interval * 1000);
        }
    });
          
    $(document).ready(function () {
        if (!active_page('/tasks')) {
        // if ($.inArray($(location).attr('pathname'), [url_prefix() + '/', url_prefix() + '/dashboard', url_prefix() + '/broker', url_prefix() + '/monitor']) !== -1) {           
            return;
        }

        $('#tasks-table').DataTable({
            rowId: 'uuid',
            searching: true,
            scrollX: true,
            scrollCollapse: true,
            processing: true,
            serverSide: true,
            colReorder: true,
            lengthMenu: [15, 30, 50, 100],
            pageLength: 50,
            language: {
                lengthMenu: 'Show _MENU_ tasks',
                info: 'Showing _START_ to _END_ of _TOTAL_ tasks',
                infoFiltered: '(filtered from _MAX_ total tasks)'
            },
            ajax: {
                type: 'POST',
                url: url_prefix() + '/tasks/datatable',
                data: function (d) {
                    d.selected = $('#select-type option:selected').val();
                    d.state = $('#select-state option:selected').val();
                }
            },
            order: [
                [7, "desc"]
            ],
            oSearch: {
                "sSearch": $.urlParam('state') ? 'state:' + $.urlParam('state') : ''
            },
            columnDefs: [{
                targets: 0,
                data: 'name',
                visible: isColumnVisible('name'),
                render: function (data, type, full, meta) {
                    return data;
                }
            }, {
                targets: 1,
                data: 'uuid',
                visible: isColumnVisible('uuid'),
                orderable: false,
                className: "text-nowrap",
                render: function (data, type, full, meta) {
                    return '<a href="' + url_prefix() + '/task/' + encodeURIComponent(data) + '">' + data + '</a>';
                }
            }, {
                targets: 2,
                data: 'action_id',
                visible: isColumnVisible('action_id'),
                orderable: true,
            },{
                targets: 3,
                data: 'cycle_dt',
                orderable: true,
                visible: isColumnVisible('cycle_dt'),
            },{
                targets: 4,
                data: 'state',
                visible: isColumnVisible('state'),
                className: "text-center",
                render: render_status
            }, {
                targets: 5,
                data: 'args',
                className: "text-nowrap overflow-auto",
                visible: isColumnVisible('args'),
                render: htmlEscapeEntities
            }, {
                targets: 6,
                data: 'kwargs',
                className: "text-nowrap overflow-auto",
                visible: isColumnVisible('kwargs'),
                render: htmlEscapeEntities
            }, {
                targets: 7,
                data: 'result',
                visible: isColumnVisible('result'),
                className: "text-nowrap overflow-auto",
                render: htmlEscapeEntities
            }, {
                targets: 8,
                data: 'received',
                className: "text-nowrap",
                visible: isColumnVisible('received'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            }, {
                targets: 9,
                data: 'started',
                className: "text-nowrap",
                visible: isColumnVisible('started'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            }, {
                targets: 10,
                data: 'timestamp',
                visible: isColumnVisible('timestamp'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            },{
                targets: 11,
                data: 'runtime',
                className: "text-center",
                visible: isColumnVisible('runtime'),
                render: function (data, type, full, meta) {
                    return data ? data.toFixed(2) : data;
                }
            }, {
                targets: 12,
                data: 'worker',
                visible: isColumnVisible('worker'),
                render: function (data, type, full, meta) {
                    return '<a href="' + url_prefix() + '/worker/' + encodeURIComponent(data) + '">' + data + '</a>';
                }
            }, {
                targets: 13,
                data: 'exchange',
                visible: isColumnVisible('exchange')
            }, {
                targets: 14,
                data: 'routing_key',
                visible: isColumnVisible('routing_key')
            }, {
                targets: 15,
                data: 'retries',
                className: "text-center",
                visible: isColumnVisible('retries')
            }, {
                targets: 16,
                data: 'revoked',
                className: "text-nowrap",
                visible: isColumnVisible('revoked'),
                render: function (data, type, full, meta) {
                    if (data) {
                        return format_time(data);
                    }
                    return data;
                }
            }, {
                targets: 17,
                data: 'exception',
                className: "text-nowrap",
                visible: isColumnVisible('exception')
            }, {
                targets: 18,
                data: 'expires',
                visible: isColumnVisible('expires')
            }, {
                targets: 19,
                data: 'eta',
                visible: isColumnVisible('eta')
            }, ],
        });
        var autorefresh_interval = $.urlParam('autorefresh') || 1;
        if (autorefresh !== 0) {
            setInterval( function () {
                $('#tasks-table').DataTable().ajax.reload(null, false);
            }, autorefresh_interval * 1000);
        }
    });

    return {
        connect_tail_socket: connect_tail_socket,
        connect_task_socket: connect_task_socket,
        connect_tasks_socket: connect_tasks_socket,
        format_duration: format_duration,
        format_isotime: format_isotime,
        format_time: format_time,
        isColumnVisible: isColumnVisible,
        // on_add_consumer: on_add_consumer,
        // on_alert_close: on_alert_close,
        // on_cancel_consumer: on_cancel_consumer,
        on_cancel_task_filter: on_cancel_task_filter,
        on_cycles_update: on_cycles_update,
        // on_dashboard_update: on_dashboard_update,
        // on_pool_autoscale: on_pool_autoscale,
        // on_pool_grow: on_pool_grow,
        // on_pool_shrink: on_pool_shrink,
        // on_task_rate_limit: on_task_rate_limit,
        // on_task_retry: on_task_retry,
        // on_task_revoke: on_task_revoke,
        // on_task_terminate: on_task_terminate,
        // on_task_timeout: on_task_timeout,
        on_task_update: on_task_update,
        on_tasks_update: on_tasks_update,
        on_worker_refresh: on_worker_refresh,
        pprint_json: pprint_json,
        refresh_selected: refresh_selected,
        render_collapsable: render_collapsable,
        render_status: render_status,
        restart_selected: restart_selected,
        shutdown_selected: shutdown_selected,
        url_prefix: url_prefix,
    };

}(jQuery));
