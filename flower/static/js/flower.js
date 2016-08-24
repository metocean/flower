
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

    function sum(a, b) {
        return parseInt(a, 10) + parseInt(b, 10);
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
        var table = $('#cycles-table').DataTable();
        if (update.hostname.indexOf("cycler") > -1) { 
            if  ($.inArray(update.type, ['task-started','task-succeeded','task-failed']) > -1 ) {
                window.location.reload();
            } else if (update.type == "task-running") {
                var progresscell = $("#"+update.uuid+" td:eq(1)"),
                    timestampcell = $("#"+update.uuid+" td:eq(3)"),
                    workercell = $("#"+update.uuid+" td:eq(4)");
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

    function create_graph(data, id, width, height, metric) {
        id = id || '';
        width = width || 500;
        height = height || 300;
        metric = metric || '';

        var name, seriesData = [],
            palette, graph, ticksTreatment, timeUnit, xAxis, yAxis, hoverDetail,
            legend, shelving, order, highlighter;
        for (name in data) {
            if (data.hasOwnProperty(name)) {
                seriesData.push({
                    name: name
                });
            }
        }

        palette = new Rickshaw.Color.Palette({
            scheme: 'colorwheel'
        });

        graph = new Rickshaw.Graph({
            element: document.getElementById("chart" + id),
            width: width,
            height: height,
            renderer: 'stack',
            series: new Rickshaw.Series(seriesData, palette),
            maxDataPoints: 10000,
            padding: {
                top: 0.1,
                left: 0.01,
                right: 0.01,
                bottom: 0.01
            },
        });

        ticksTreatment = 'glow';

        timeUnit = new Rickshaw.Fixtures.Time.Local();
        timeUnit.formatTime = function (d) {
            return moment(d).format("yyyy.mm.dd HH:mm:ss");
        };
        timeUnit.unit("minute");

        xAxis = new Rickshaw.Graph.Axis.Time({
            graph: graph,
            timeFixture: new Rickshaw.Fixtures.Time.Local(),
            ticksTreatment: ticksTreatment,
            timeUnit: timeUnit
        });

        xAxis.render();

        yAxis = new Rickshaw.Graph.Axis.Y({
            graph: graph,
            tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
            ticksTreatment: ticksTreatment,
        });

        yAxis.render();

        hoverDetail = new Rickshaw.Graph.HoverDetail({
            graph: graph,
            yFormatter: function (y) {
                if (y % 1 === 0) {
                    return y + metric;
                } else {
                    return y.toFixed(2) + metric;
                }
            }
        });

        legend = new Rickshaw.Graph.Legend({
            graph: graph,
            element: document.getElementById('legend' + id)
        });

        shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
            graph: graph,
            legend: legend
        });

        order = new Rickshaw.Graph.Behavior.Series.Order({
            graph: graph,
            legend: legend
        });

        highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
            graph: graph,
            legend: legend
        });

        legend.shelving = shelving;
        graph.series.legend = legend;

        graph.render();
        return graph;
    }

    function update_graph(graph, url, lastquery) {
        $.ajax({
            type: 'GET',
            url: url,
            data: {
                lastquery: lastquery
            },
            success: function (data) {
                graph.series.addData(data);
                graph.update();
            },
        });
    }

    function current_unix_time() {
        var now = new Date();
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
            now.getUTCDate(), now.getUTCHours(),
            now.getUTCMinutes(), now.getUTCSeconds()) / 1000;
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
            update_func(update)
        };
    }

    function connect_task_socket(update_func, uuid) {
        var host = $(location).attr('host'),
            protocol = $(location).attr('protocol') === 'http:' ? 'ws://' : 'wss://',
            ws = new WebSocket(protocol + host + "/api/task/events/update-task/"+uuid);
        ws.onmessage = function (event) {
            var update = $.parseJSON(event.data);
            update_func(update)
        };
    }

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
        timestamp = timestamp.format("YYYY-MM-DD HH:mm:ss "+tz);
        console.log(update)
        switch (status){
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
                add_or_update_field('args', update.args, 'state', null);
                add_or_update_field('kwargs', update.kwargs, 'args', null);
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
                    state = "RUNNING";
                update_progress($('#result td:eq(1)'), update)
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
                add_or_update_field("result", update.result, "kwargs", null);
                add_or_update_field("succedded", timestamp, "started", null);
                add_or_update_field("runtime", update.runtime, "timestamp", null);
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
                $('h2').append('<button style="float: right" class="btn btn-danger" onclick="flower.on_task_retry(event)">Retry</button>');
                break;
            case 'terminate':
               $('h2').append('<button style="float: right" class="btn btn-danger" onclick="flower.on_task_terminate(event)">Terminate</button>');
               break;
            case 'revoke':
                $('h2').append('<button  style="float: right" class="btn btn-danger" onclick="flower.on_task_revoke(event)">Revoke</button>');
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
        if ($.inArray($(location).attr('pathname'), [url_prefix() + '/', url_prefix() + '/dashboard']) !== -1) {
            var host = $(location).attr('host'),
                protocol = $(location).attr('protocol') === 'http:' ? 'ws://' : 'wss://',
                ws = new WebSocket(protocol + host + url_prefix() + "/update-dashboard");
            ws.onmessage = function (event) {
                var update = $.parseJSON(event.data);
                on_dashboard_update(update);
            };
        } else if ($.inArray('task', $(location).attr('pathname').split('/')) !== -1)  {
            var uuid = $(location).attr('pathname').split('/')[2],
                logpath = $('#logpath').text()
            connect_task_socket(on_task_update, uuid);
            if (logpath){
                connect_tail_socket(logpath)
            };
        }

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

        if ($(location).attr('pathname') === url_prefix() + '/monitor') {
            var sts = current_unix_time(),
                fts = current_unix_time(),
                tts = current_unix_time(),
                updateinterval = parseInt($.urlParam('updateInterval'), 10) || 3000,
                succeeded_graph = null,
                failed_graph = null,
                time_graph = null,
                broker_graph = null;

            $.ajax({
                type: 'GET',
                url: url_prefix() + '/monitor/succeeded-tasks',
                data: {
                    lastquery: current_unix_time()
                },
                success: function (data) {
                    succeeded_graph = create_graph(data, '-succeeded');
                    succeeded_graph.update();

                    succeeded_graph.series.setTimeInterval(updateinterval);
                    setInterval(function () {
                        update_graph(succeeded_graph,
                            url_prefix() + '/monitor/succeeded-tasks',
                            sts);
                        sts = current_unix_time();
                    }, updateinterval);

                },
            });

            $.ajax({
                type: 'GET',
                url: url_prefix() + '/monitor/completion-time',
                data: {
                    lastquery: current_unix_time()
                },
                success: function (data) {
                    time_graph = create_graph(data, '-time', null, null, 's');
                    time_graph.update();

                    time_graph.series.setTimeInterval(updateinterval);
                    setInterval(function () {
                        update_graph(time_graph,
                            url_prefix() + '/monitor/completion-time',
                            tts);
                        tts = current_unix_time();
                    }, updateinterval);

                },
            });

            $.ajax({
                type: 'GET',
                url: url_prefix() + '/monitor/failed-tasks',
                data: {
                    lastquery: current_unix_time()
                },
                success: function (data) {
                    failed_graph = create_graph(data, '-failed');
                    failed_graph.update();

                    failed_graph.series.setTimeInterval(updateinterval);
                    setInterval(function () {
                        update_graph(failed_graph,
                            url_prefix() + '/monitor/failed-tasks',
                            fts);
                        fts = current_unix_time();
                    }, updateinterval);

                },
            });

            $.ajax({
                type: 'GET',
                url: url_prefix() + '/monitor/broker',
                success: function (data) {
                    broker_graph = create_graph(data, '-broker');
                    broker_graph.update();

                    broker_graph.series.setTimeInterval(updateinterval);
                    setInterval(function () {
                        update_graph(broker_graph,
                            url_prefix() + '/monitor/broker');
                    }, updateinterval);

                },
            });

        }

    });

    $(document).ready(function () {
        if ($.inArray($(location).attr('pathname'), [url_prefix() + '/tasks', url_prefix() + '/broker', url_prefix() + '/monitor']) !== -1) {
            return;
        }

        $('#workers-table').DataTable({
            rowId: 'name',
            searching: true,
            paginate: false,
            select: true,
            scrollX: true,
            scrollY: 500,
            scrollCollapse: true,
            order: [
                [1, "asc"]
            ],
            columnDefs: [{
                targets: 0,
                data: 'name',
                render: function (data, type, full, meta) {
                    return '<a href="' + url_prefix() + '/worker/' + data + '">' + data + '</a>';
                }
            }, {
                targets: 1,
                data: 'status',
                render: function (data, type, full, meta) {
                    if (data) {
                        return '<span class="label label-success">Online</span>';
                    } else {
                        return '<span class="label label-important">Offline</span>';
                    }
                }
            }, {
                targets: 2,
                data: 'active'
            }, {
                targets: 3,
                data: 'processed'
            }, {
                targets: 4,
                data: 'failed'
            }, {
                targets: 5,
                data: 'succeeded'
            }, {
                targets: 6,
                data: 'retried'
            }, {
                targets: 7,
                data: 'loadavg',
                render: function (data, type, full, meta) {
                    if (Array.isArray(data)) {
                        return data.join(', ');
                    }
                    return data;
                }
            }, ],
        });
    });

    $(document).ready(function () {
        if ($.inArray($(location).attr('pathname'), ['/tasks']) !== -1) {
            $('#tasks-table').DataTable({
                rowId: 'uuid',
                searching: true,
                paginate: true,
                scrollX: true,
                scrollCollapse: true,
                processing: true,
                serverSide: true,
                colReorder: true,
                lengthMenu: [ 50, 100, 200 ],
                drawCallback: collapse_collapsable,
                initComplete: function() {
                  connect_tasks_socket(on_tasks_update);
                },
                ajax: {
                    url: url_prefix() + '/tasks/datatable'
                },
                order: [
                    [8, "asc"]
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
                    render: function (data, type, full, meta) {
                        return '<a href="' + url_prefix() + '/task/' + data + '">' + data + '</a>';
                    }
                },{
                    targets: 2,
                    data: 'action_id',
                    visible: isColumnVisible('action_id'),
                    orderable: true,
                },{
                    targets: 3,
                    data: 'cycle_dt',
                    orderable: true,
                    visible: isColumnVisible('cycle_dt')
                },{
                    targets: 4,
                    data: 'state',
                    visible: isColumnVisible('state'),
                    render: render_status
                }, {
                    targets: 5,
                    data: 'args',
                    visible: isColumnVisible('args'),
                    render: render_collapsable
                }, {
                    targets: 6,
                    data: 'kwargs',
                    visible: isColumnVisible('kwargs'),
                    render: render_collapsable
                }, {
                    targets: 7,
                    data: 'result',
                    visible: isColumnVisible('result'),
                    render: render_collapsable
                }, {
                    targets: 8,
                    data: 'received',
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
                    visible: isColumnVisible('started'),
                    render: function (data, type, full, meta) {
                        if (data) {
                            return format_time(data);
                        }
                        return data;
                    }
                }, {
                    targets: 10,
                    data: 'runtime',
                    visible: isColumnVisible('runtime'),
                    render: format_duration
                }, {
                    targets: 11,
                    data: 'worker',
                    visible: isColumnVisible('worker')
                }, {
                    targets: 12,
                    data: 'exchange',
                    visible: isColumnVisible('exchange')
                }, {
                    targets: 13,
                    data: 'routing_key',
                    visible: isColumnVisible('routing_key')
                }, {
                    targets: 14,
                    data: 'retries',
                    visible: isColumnVisible('retries')
                }, {
                    targets: 15,
                    data: 'revoked',
                    visible: isColumnVisible('revoked')
                }, {
                    targets: 16,
                    data: 'exception',
                    visible: isColumnVisible('exception'),
                    render: render_collapsable
                }, {
                    targets: 17,
                    data: 'expires',
                    visible: isColumnVisible('expires'),
                    render: function (data, type, full, meta) {
                        if (data) {
                            return format_isotime(data);
                        }
                        return data;
                    }
                }, {
                    targets: 18,
                    data: 'eta',
                    visible: isColumnVisible('eta')
                }, ],
            });
        } else if ($.inArray($(location).attr('pathname'), ['/cycles']) !== -1) {
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
                        d.cycle_dt = $('#select-cycle option:selected').text();
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
            $('#select-cycle').change(function(){
                var table = $('#cycles-table').DataTable();
                table.draw();
            });
        } else if ($.inArray($(location).attr('pathname'), ['/crontab']) !== -1) {
            $('#crontab-table').DataTable({
                rowId: 'uuid',
                searching: true,
                paginate: true,
                scrollX: true,
                scrollCollapse: true,
                processing: true,
                serverSide: true,
                colReorder: true,
                lengthMenu: [ 50, 100, 200, 500],
                initComplete: function() {
                  connect_tasks_socket(on_tasks_update);
                },
                ajax: {
                    url: url_prefix() + '/crontab/datatable',
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
                    targets: 4,
                    data: 'started',
                    visible: isColumnVisible('started'),
                    render: function (data, type, full, meta) {
                        if (data) {
                            return format_time(data);
                        }
                        return data;
                    }
                },  {
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
                },],
            });
            $('#select-cycle').change(function(){
                var table = $('#cycles-table').DataTable();
                table.draw();
            });
        } else if ($.inArray('task', $(location).attr('pathname').split('/')) !== -1) {
            $('#logfile').scrollTop($('#logfile')[0].scrollHeight);
        } else { return }
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
        on_task_update: on_task_update,
    };

}(jQuery));
