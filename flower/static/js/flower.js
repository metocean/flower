var flower = (function () {
    "use strict";
    /*jslint browser: true */
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
        return $('#workers-table tr').has('td.is_selected > input:checked');
    }

    function select_all_workers() {
        $('#workers-table td.is_selected > input').filter(':not(:checked)').click();
    }

    function select_none_workers() {
        $('#workers-table td.is_selected > input:checked').click();
    }

    function toggle_selected_workers(event) {
        var $checkbox = $('#select-workers-toggler');

        $checkbox.is(':checked') ? select_all_workers()
                                 : select_none_workers();
    }

    function shutdown_selected(event) {
        var $selected_workes = get_selected_workers();

        /* atomic would be better with list of ids (not-names) */
        $selected_workes.each(function () {
            var $worker = $(this),
                worker_name = $worker.attr('id');

            $.ajax({
                type: 'POST',
                url: url_prefix() + '/api/worker/shutdown/' + worker_name,
                dataType: 'json',
                data: { workername: worker_name },
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
        var $selected_workes = get_selected_workers();

        /* atomic would be better with list of ids (not-names) */
        $selected_workes.each(function () {
            var $worker = $(this),
                worker_name = $worker.attr('id');

            $.ajax({
                type: 'POST',
                url: url_prefix() + '/api/worker/pool/restart/' + worker_name,
                dataType: 'json',
                data: { workername: worker_name },
                success: function (data) {
                    show_success_alert(data.message);
                },
                error: function (data) {
                    show_error_alert(data.responseText);
                }
            });
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
                    $('#tab-queues').load(url_prefix() + '/worker/' + workername + ' #tab-queues').fadeIn('show');
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
                    $('#tab-queues').load(url_prefix() + '/worker/' + workername + ' #tab-queues').fadeIn('show');
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
            type = $(event.target).html().toLowerCase(),
            timeout = $(event.target).siblings().closest("input").val(),
            data = {};

        taskname = taskname.split(' ')[0]; // removes [rate_limit=xxx]

        console.log(type);

        data.taskname = taskname;
        data[type] = timeout;

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/timeout/' + workername,
            dataType: 'json',
            data: data,
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
            url: url_prefix() + '/api/task/rate-limit/' + workername,
            dataType: 'json',
            data: {
                'taskname': taskname,
                'ratelimit': ratelimit,
            },
            success: function (data) {
                show_success_alert(data.message);
                setTimeout(function () {
                    $('#tab-limits').load(url_prefix() + '/worker/' + workername + ' #tab-limits').fadeIn('show');
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

        var taskid = $('#taskid').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/revoke/' + taskid,
            dataType: 'json',
            data: {
                'terminate': true,
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

        var taskid = $('#taskid').text(),
            task = $('#task').text(),
            action_id = $('#action_id').text(),
            cycle_dt = $('#cycle_dt').text(),
            routing_key = $('#routing_key').text();

        $.ajax({
            type: 'POST',
            url: url_prefix() + '/api/task/retry/' + taskid,
            dataType: 'json',
            data: {
                'task': task,
                'action_id': action_id,
                'cycle_dt': cycle_dt,
                'routing_key': routing_key,
            },
            success: function (data) {
                show_success_alert(data.message);
            },
            error: function (data) {    
                show_error_alert(data.responseText);
            }
        });
    }

    function on_workers_table_update(update) {
        $.each(update, function (name) {
            var id = encodeURIComponent(name),
                sel = id.replace(/([ #;&,.+*~\':"!^$[\]()=>|\/%@])/g,'\\$1'),
                tr = $('#' + sel);

            if (tr.length === 0) {
                $('#workers-table-row').clone().removeClass('hidden').attr('id', id).appendTo('tbody');
                tr = $('#' + sel);
                tr.children('td').children('a').attr('href', url_prefix() + '/worker/' + name).text(name);
            }

            var stat = tr.children('td:eq(2)').children(),
                concurrency = tr.children('td:eq(3)'),
                completed_tasks = tr.children('td:eq(4)'),
                running_tasks = tr.children('td:eq(5)'),
                queues = tr.children('td:eq(6)');

            stat.text($(this).attr('status') ? "Online" : "Offline");
            stat.removeClass("label-success label-important");
            stat.addClass($(this).attr('status') ? "label-success" : "label-important");
            concurrency.text($(this).attr('concurrency'));
            completed_tasks.text($(this).attr('completed_tasks'));
            running_tasks.text($(this).attr('running_tasks'));
            queues.text($(this).attr('queues').toString().replace(/,/g, ', '));
        });
    }


    function on_cancel_task_filter(event) {
        event.preventDefault();
        event.stopPropagation();

        $('#task-filter-form').each(function () {
            $(this).find('SELECT').val('');
        });

        $('#task-filter-form').submit();
    }

    function create_graph(data, id, width, height) {
        id = id || '';
        width = width || 700;
        height = height || 400;

        var name, seriesData = [];
        for (name in data) {
            seriesData.push({name: name});
        }

        var palette = new Rickshaw.Color.Palette({scheme: 'colorwheel'});

        var graph = new Rickshaw.Graph({
            element: document.getElementById("chart" + id),
            width: width,
            height: height,
            renderer: 'stack',
            series: new Rickshaw.Series(seriesData, palette),
            maxDataPoints: 10000,
        });

        var ticksTreatment = 'glow';

        var xAxis = new Rickshaw.Graph.Axis.Time({
            graph: graph,
            ticksTreatment: ticksTreatment,
        });

        xAxis.render();

        var yAxis = new Rickshaw.Graph.Axis.Y({
            graph: graph,
            tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
            ticksTreatment: ticksTreatment
        });

        yAxis.render();

        var slider = new Rickshaw.Graph.RangeSlider({
            graph: graph,
            element: $('#slider' + id)
        });

        var hoverDetail = new Rickshaw.Graph.HoverDetail({
            graph: graph
        });

        var legend = new Rickshaw.Graph.Legend({
            graph: graph,
            element: document.getElementById('legend' + id)
        });

        var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
            graph: graph,
            legend: legend
        });

        var order = new Rickshaw.Graph.Behavior.Series.Order({
            graph: graph,
            legend: legend
        });

        var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
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
            data: {lastquery: lastquery},
            success: function (data) {
                graph.series.addData(data);
                graph.update();
            },
        });
    }

    function current_unix_time() {
        var now = new Date();
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
                        now.getUTCDate(),  now.getUTCHours(),
                        now.getUTCMinutes(), now.getUTCSeconds())/1000;
    }

    function url_prefix() {
        // prefix is initialized in base.html
        if (prefix) {
            return '/' + prefix;
        }
        return '';
    }

    $.urlParam = function(name){
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
        return results && results[1] || 0;
    }

    function on_cycles_update(update) {
        var tr = $('#'+update.uuid);
        if (tr) {
            console.log(update);
            if (update.type == 'task-received') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-default").text('RECEIVED');
                tr.children('td:eq(4)').text(update.eta ? update.eta : "");
            } else if (update.type == 'task-started') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-info").text('STARTED');
            } else if (update.type == 'task-succeeded') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-success").text('SUCCESS');
                tr.children('td:eq(7)').text(update.runtime.toFixed(2));
            } else if (update.type == 'task-failed') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('FAILURE');
            } else if (update.type == 'task-revoked') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('REVOKED');
            } else if (update.type == 'task-retried') {
                tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('RETRY');
                tr.children('td:eq(4)').text(update.eta ? update.eta : "");
            } else if (update.type == 'task-running') {
                var progress = update.result['progress']*100,
                    state = update.result['state'];
                tr.children('td:eq(2)').text("");
                if (tr.children('td:eq(2)').children().length == 0) {
                    $('#'+update.uuid+' td:eq(2)').prepend('<div class="progress"></div>');
                    $('#'+update.uuid+' td:eq(2) .progress').prepend('<div class="bar" style="width:' + 
                                                                      progress + '%;">'+'</div>');
                    $('#'+update.uuid+' td:eq(2) .progress .bar').text(progress.toFixed(2)+'%');
                } else {
                    $('#'+update.uuid+' td:eq(2) .progress .bar').css('width:'+progress+'%');
                    $('#'+update.uuid+' td:eq(2) .progress .bar').text(progress.toFixed(2)+'%');
                }
            }
            var timestamp = moment.unix(update.timestamp);
            tr.children("td:eq(6)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
        }
    }

    function on_tasks_update(update) {
        console.log(update);
        var tr = $('#'+update.uuid);
        if (update.type == 'task-received') {
            var uuids = [],
            rows = document.getElementsByTagName("tr");
            for(var i=2;i< rows.length;i++){uuids.push(rows[i].id);}
            if (($.inArray(update.uuid, uuids) == -1)) {
                console.log('clonnig');
                var tr = $('#row-template').clone();
                tr.appendTo('tbody');
                tr.removeClass('hidden').attr('id', update.uuid).prependTo('tbody');
                tr.children('td:eq(0)').text(update.name);
                tr.children('td:eq(1)').children('a').attr('href', url_prefix() + '/task/' + update.uuid).text(update.uuid.substr(0,8)+' ...');   
            } else {
                var tr = $('#'+update.uuid);
            }
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-default").text('RECEIVED');
            tr.children('td:eq(3)').text(update.args);
            tr.children('td:eq(4)').text(update.kwargs);
            var timestamp = moment.unix(update.local_received);
            tr.children('td:eq(6)').text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
            tr.children('td:eq(7)').text(update.eta ? update.eta : "");
        } else if (update.type == 'task-started') {
            var tr = $('#'+update.uuid);
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-info").text('STARTED');
            var timestamp = moment.unix(update.timestamp);
            tr.children('td:eq(8)').text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
        } else if (update.type == 'task-succeeded') {
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-success").text('SUCCESS');
            var timestamp = moment.unix(update.timestamp);
            tr.children('td:eq(9)').text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
            tr.children('td:eq(5)').text(update.result);
            tr.children('td:eq(10)').text(update.runtime.toFixed(2));
        } else if (update.type == 'task-failed') {
            var tr = $('#'+update.uuid);
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('FAILURE');
            tr.children('td:eq(5)').text(update.result);
        } else if (update.type == 'task-revoked') {
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('REVOKED');
        } else if (update.type == 'task-retried') {
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-important").text('RETRY');
            tr.children('td:eq(5)').text(update.result);
        } else if (update.type == 'task-running') {
            var progress = update.result['progress']*100,
                state = update.result['state'];
            tr.children('td:eq(2)').children('span').removeClass().addClass("label label-info").text('RUNNING');
            tr.children('td:eq(5)').text("");
            if (tr.children('td:eq(5)').children().length == 0) {
                $('#'+update.uuid+' td:eq(5)').prepend('<div class="progress"></div>');
                $('#'+update.uuid+' td:eq(5) .progress').prepend('<div class="bar" style="width:' + 
                                                                  progress + '%;">'+'</div>');
                $('#'+update.uuid+' td:eq(5) .progress .bar').text(progress.toFixed(2)+'%');
            } else {
                $('#'+update.uuid+' td:eq(5) .progress .bar').css('width:'+progress+'%');
                $('#'+update.uuid+' td:eq(5) .progress .bar').text(progress.toFixed(2)+'%');
            }
        }
    }

    function on_task_update(update) {
        var timestamp = moment.unix(update.timestamp);
        if (update.type == 'task-received') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-default").text('RECEIVED');
            $("#received td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'))
            $("#eta td:eq(1)").text(update.eta ? update.eta : "");
        } else if (update.type == 'task-started') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-info").text('STARTED');
            $("#started td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
        } else if (update.type == 'task-succeeded') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-success").text('SUCCESS');
            $("#result td:eq(1)").text(update.result);
            if ($("#succeeded").length == 0){
                $('#started').after('<tr><td id="#succedded">Succeeded</td><td>'+ 
                                     timestamp.format('DD-MM-YYYY HH:mm:ss') +'</td>')
            } else {
                $("#succedded td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'))
            }
            if ($("#runtime").length == 0){
                $('#clock').before('<tr><td id="#runtime">Runtime</td><td>'+update.runtime+'</td>')
            } else {
                $("#runtime").text(update.runtime)
            }
            $('h2 button').remove()
        } else if (update.type == 'task-failed') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-important").text('FAILURE');
            $("#result td:eq(1)").text("None");
        } else if (update.type == 'task-revoked') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-important").text('REVOKED');
            if ($("#revoked").length == 0){
                $('#expires').before('<tr><td id="#revoked">Revoked</td><td>'+ 
                                     timestamp.format('DD-MM-YYYY HH:mm:ss') +'</td>')
            } else {
                $("#revoked td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'))
            }
            $('h2 button').remove()
            $('h2').append('<button class="btn btn-danger" onclick="flower.on_task_retry(event)" style="float: right">Retry</button>')
        } else if (update.type == 'task-retried') {
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-important").text('RETRY');
            $("#state td:eq(1)").text(update.result);
            if ($("#retried").length == 0){
                $('#started').after('<tr><td id="#retried">Retried</td><td>'+ 
                                     timestamp.format('DD-MM-YYYY HH:mm:ss') +'</td>')
            } else {
                $("#retried td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'))
            }
        } else if (update.type == 'task-running') {
            var progress = update.result['progress']*100,
                state = update.result['state'];
            $("#state td:eq(1)").children('span').removeClass().addClass("label label-info").text('RUNNING');
            $("#result td:eq(1)").text("");
            if ($("#result td:eq(1)").children().length == 0) {
                $("#result td:eq(1)").prepend('<div class="progress"></div>');
                $("#result td:eq(1) .progress").prepend('<div class="bar" style="width:' + 
                                                                  progress + '%;">'+'</div>');
            } else {
                $("#result td:eq(1) .progress .bar").css('width:'+progress+'%');
            }
            if (state) {
              var text = progress.toFixed(2)+'%' + ' - ' + state;
            } else {
              var text = progress.toFixed(2)+'%'
            }
            $("#result td:eq(1) .progress .bar").text(text);
        }
        if ($.inArray(update.type, ['task-retried', 'task-failed']) != -1){
            if ($("#traceback").length == 0){
                $('#clock').before('<td id="traceback">Traceback</td><td><pre>'+ update.traceback +'</pre></td>')
            } else {
                $("#traceback td:eq(1)").text(update.traceback)
            }
            if ($("#exception").length == 0){
                $('#worker').after('<td id="exception">Exception</td><td>'+update.exception+'</td>')
            } else {
                $("#exception td:eq(1)").text(update.exception)
            }
        }
        $("#timestamp td:eq(1)").text(timestamp.format('DD-MM-YYYY HH:mm:ss'));
        $("#clock td:eq(1)").text(update.clock);
    }

    function connect_tasks_socket(update_function, uuid) {
        var host = $(location).attr('host'),
            protocol = $(location).attr('protocol') == 'http:' ? 'ws://' : 'wss://',
            events = ['task-received', 'task-started', 'task-succeeded',
                      'task-failed', 'task-revoked', 'task-retried', 'task-running'],
            sockets = [];

        events.forEach(function(task_event, idx) {
            var ws = new WebSocket(protocol + host + url_prefix() + '/api/task/events/' + task_event +'/' + uuid);
            ws.onmessage = function (event) {
                var update = $.parseJSON(event.data);
                update_function(update);
            };
            sockets.push(ws)
        });
        
        $(window).on('beforeunload', function(){
            sockets.forEach(function(ws){
                ws.close()    
            });
        });
    }

    $(document).ready(function () {
        console.log($(location).attr('pathname'));
        if ($.inArray($(location).attr('pathname'), [url_prefix(), url_prefix() + '/workers'])) {
            var host = $(location).attr('host'),
                protocol = $(location).attr('protocol') == 'http:' ? 'ws://' : 'wss://',
                ws = new WebSocket(protocol + host + url_prefix() + "/update-workers");
            ws.onmessage = function (event) {
                var update = $.parseJSON(event.data);
                on_workers_table_update(update);
            };
            $(window).on('beforeunload', function(){
                ws.close();
            });
        } 

        if ($(location).attr('pathname') == '/tasks') {
            connect_tasks_socket(on_tasks_update, "")
        } else if ($(location).attr('pathname') == '/cycles') {
            connect_tasks_socket(on_cycles_update, "")
        } else if ($.inArray('task', $(location).attr('pathname').split('/'))) {
            var uuid = $(location).attr('pathname').split('/')[2]
            connect_tasks_socket(on_task_update, uuid)
        }

        //https://github.com/twitter/bootstrap/issues/1768
        var shiftWindow = function() { scrollBy(0, -50) };
        if (location.hash) shiftWindow();
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
                updateinterval = parseInt($.urlParam('updateInterval')) || 3000,
                succeeded_graph = null,
                failed_graph = null,
                time_graph = null,
                broker_graph = null;

            $.ajax({
                type: 'GET',
                url: url_prefix() + '/monitor/succeeded-tasks',
                data: {lastquery: current_unix_time()},
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
                data: {lastquery: current_unix_time()},
                success: function (data) {
                    time_graph = create_graph(data, '-time');
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
                data: {lastquery: current_unix_time()},
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

    return {
        toggle_selected_workers: toggle_selected_workers,
        select_all_workers: select_all_workers,
        select_none_workers: select_none_workers,
        shutdown_selected: shutdown_selected,
        restart_selected: restart_selected,
        on_alert_close: on_alert_close,
        on_pool_grow: on_pool_grow,
        on_pool_shrink: on_pool_shrink,
        on_pool_autoscale: on_pool_autoscale,
        on_add_consumer: on_add_consumer,
        on_cancel_consumer: on_cancel_consumer,
        on_task_timeout: on_task_timeout,
        on_task_rate_limit: on_task_rate_limit,
        on_cancel_task_filter: on_cancel_task_filter,
        on_task_revoke: on_task_revoke,
        on_task_retry: on_task_retry,
        on_task_terminate: on_task_terminate,
    };

}(jQuery));
