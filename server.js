var http = require('http');
var url = require('url');
var async = require('async');
var fs = require('fs');

var serverPort = 8888;
var logData = function(message,request,response) {
	var dateLog = new Date();
	var logDir = './log';
	if (!fs.existsSync(logDir)) 
		fs.mkdirSync(logDir);
		
	var date = dateLog.getFullYear() + '-' + dateLog.getMonth() + '-' + dateLog.getDate();
	var time = dateLog.getHours + ':' + dateLog.getMinutes + ':' + dateLog.getSeconds;
	var logPath = logDir + '/' + date + '.log';
	var logMessage = date + ' ' + time + ' >>\r\n';
	logMessage += message + '\r\n' + request + '\r\n' + response + '\r\n';
	fs.appendFile(logPath,logMessage,function(err){console.log(err)});
};

http.createServer(function (request, response) {
    var requestBody = '';
	var requestData = {};
	var errorMessages = {
		404: 'Invalid End Point'
	};
	var task = function(i,callback) {
		var jsonData = JSON.stringify(requestData.data[i]);
		var req = http.request({
			hostname: requestData.url.host,
			port: 80,
			path: requestData.url.pathname,
			method: 'POST',
			headers: {
				'X-Auth-Code': requestData.mac[i],
				'Content-Type': 'application/json',
				'Content-Length': jsonData.length
			}
		}, function(res) {
			res.setEncoding('utf8');
			var result = '';
			res.on('data', function (data) {
				result += data;
			});
			res.on('end',function(){
				if(res.statusCode != 200)
					result = errorMessages[res.statusCode] || 'Error: Status Code' + res.statusCode;
				callback(false,result);
			});
		});
		req.write(jsonData);
		req.end();
	}
	
    request.on('data', function(data) {
		var start = new Date();
		requestBody += data;
    });
	
    request.on('end', function() {
		if(requestBody.length) 
			requestData = JSON.parse(requestBody);		
		
		if (!requestBody.length || !requestData.url) {
			logData('Invalid request data',requestBody,'');
			response.writeHead(400, {'Content-Type': 'text/html'});
			response.end('Bad Request');
			return;
		}
		
		requestData.url = url.parse(requestData.url,true);
		requestData.tasks = [];
		for (var i=0; i < requestData.data.length; i++) 
			requestData.tasks.push(task.bind(null,i));
		
		async.parallel(requestData.tasks,function(err,results){
			var end = new Date();
			var elapsedTime = end.getTime() - start.getTime();
			
			console.log('Elapsed time: ' + elapsedTime);
			
			results = JSON.stringify(results);
			logData('All request done. Elapsed time: ' + elapsedTime + 'ms',requestBody,results);
			
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(results);
		});
    });
	
}).listen(serverPort);

console.log('Server running at localhost:'+serverPort);
