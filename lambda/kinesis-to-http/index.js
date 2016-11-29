'use strict';

const AWS = require('aws-sdk');
const Lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const http = require('http');

const PROCESS_MESSAGE = 'process-message';

function invokePoller(functionName, message) {
	const payload = {
		operation: PROCESS_MESSAGE,
		message,
	};
	const params = {
		FunctionName: functionName,
		InvocationType: 'Event',
		Payload: new Buffer(JSON.stringify(payload)),
	};
	return new Promise((resolve, reject) => {
		Lambda.invoke(params, (err) => (err ? reject(err) : resolve()));
	});
}

function poll(event, context, callback) {
	let promises = event.Records.map((record) => {
		let unicornMessage = new Buffer(record.kinesis.data, 'base64').toString('ascii');
		return invokePoller(context.functionName, unicornMessage);
	});

	Promise.all(promises)
		.then(() => {
			const result = `Successfully processed ${event.Records.length} records.`;
			console.log(result);
			callback(null, result);
		});
}

function processMessage(unicornMessage, callback) {
	console.log(`Received message: ${unicornMessage}`);

	let options = {
		hostname: process.env.UNICORN_HOST,
		port: 80,
		path: '/',
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(unicornMessage),
		},
	};

	let req = http.request(options, (res) => {
		let body = '';
		console.log(`STATUS: ${res.statusCode}`);
		console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			body += chunk;
		});
		res.on('end', () => {
			console.log(`BODY: ${body}`);
			callback(null, unicornMessage);
		});
	});

	req.on('error', callback);

	req.write(unicornMessage);
	req.end();
}

exports.handler = (event, context, callback) => {
	try {
		if (event.operation === PROCESS_MESSAGE) {
			processMessage(event.message, callback);
		} else {
			poll(event, context, callback);
		}
	} catch (err) {
		callback(err);
	}
};
