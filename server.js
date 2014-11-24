var http = require('http');
var url = require('url');
var async = require('async');
var fs = require('fs');

var serverPort = 8888;
var logData = function(message,request,response,prompt) {
	var dateLog = new Date();
	var logDir = './log';
	if (!fs.existsSync(logDir)) 
		fs.mkdirSync(logDir);
		
	var date = dateLog.getFullYear() + '-' + (dateLog.getMonth()+1) + '-' + dateLog.getDate();
	var time = dateLog.getHours() + ':' + dateLog.getMinutes() + ':' + dateLog.getSeconds();
	var logPath = logDir + '/' + date + '.log';
	var logMessage = date + ' ' + time + ' ::\r\n>>';
	logMessage += message + '\r\n>>' + request + '\r\n>>' + response + '\r\n\r\n';
	fs.appendFile(logPath,logMessage,function(err){if(err)console.log(err)});
	
	if (prompt) console.log(date + ' ' + time + ' ' + message);
};

http.globalAgent.maxSockets = 10;
http.createServer(function (request, response) {
    var requestBody = '';
	var requestData = {};
	var errorMessages = {
		404: 'Invalid End Point'
	};
	var task = function(taskReq,callback) {
		var jsonData = taskReq.data;//JSON.stringify(taskReq.data);
		taskReq.url = url.parse(taskReq.url,true);
		
		var tstart = new Date();
		var options = {
			hostname: taskReq.url.host,
			port: 80,
			path: taskReq.url.pathname,
			agent: false,
			method: 'POST',
			headers: {
				'X-Auth-Code': taskReq.mac,
				'Content-Type': 'application/json',
				'Content-Length': jsonData.length
			}
		};
		var req = http.request(options, function(res) {
			res.setEncoding('utf8');
			var resultContent = '';
			var tdata = new Date();
			res.on('data', function (data) {
				resultContent += data;
			});
			res.on('end',function(){
				var tend = new Date();
				var result = {};
				try{
					result = JSON.parse(resultContent);
				} catch (e) { result = false; }
				if(res.statusCode != 200 || !result || !resultContent)
				result = {
					isSuccess: false,
					resultContent: resultContent,
					errorMessages: errorMessages[res.statusCode] || 'Error: Status Code' + res.statusCode
				};
				
				result.taskLatency = tend.getTime() - tstart.getTime();
				result.taskStart = tstart.getHours() + ":" + tstart.getMinutes() + ":" + tstart.getSeconds() + "." + tstart.getMilliseconds();
				result.taskEnd = tend.getHours() + ":" + tend.getMinutes() + ":" + tend.getSeconds() + "." + tend.getMilliseconds();
				result.taskData = tdata.getHours() + ":" + tdata.getMinutes() + ":" + tdata.getSeconds() + "." + tdata.getMilliseconds();
				
				callback(false,result);
			});
		});
		req.write(jsonData);
		req.end();
	};
	var start = null;
	
    request.on('data', function(data) {
		start = new Date();
		requestBody += data;
    });
	
    request.on('end', function() {
		if(requestBody.length) 
			try {
				requestData = JSON.parse(requestBody);		
			} catch (e) { requestData = []; }
		if (!requestBody.length || !requestData.length) {
			logData('Invalid request data',requestBody,'',true);
			response.writeHead(400, {'Content-Type': 'text/html'});
			response.end('Bad Request: ' + requestBody);
			return;
		}
		
		var tasks = [];
		for (var i=0; i < requestData.length; i++) 
			tasks.push(task.bind(null,requestData[i]));
		
		async.parallel(tasks,function(err,results){
			var end = new Date();
			var elapsedTime = end.getTime() - start.getTime();
			
			results = JSON.stringify(results);
			logData(
				'All request done. Elapsed time: ' + elapsedTime + 'ms. Start:' + start.getHours() + ':' + start.getMinutes() + ':' + start.getSeconds() + '.' + start.getMilliseconds() + '. End:' + end.getHours() + ':' + end.getMinutes() + ':' + end.getSeconds() + '.' + end.getMilliseconds(),
				requestBody,results,true
			);
			
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(results);
		});
    });
	
}).listen(serverPort);

logData('Server running at localhost:'+serverPort,null,null,true);
