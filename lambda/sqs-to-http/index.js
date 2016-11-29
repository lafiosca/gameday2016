'use strict';

const AWS = require('aws-sdk');
const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const Lambda = new AWS.Lambda({ apiVersion: '2015-03-31' });
const http = require('http');

const QUEUE_URL = process.env.queueUrl;
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


function processMessage(message, callback) {

	let unicornMessage = message.Body;

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

			const params = {
				QueueUrl: QUEUE_URL,
				ReceiptHandle: message.ReceiptHandle,
			};

			//SQS.deleteMessage(params, (err) => callback(err, message));
			callback(null, message);
		});
	});

	req.on('error', callback);

	req.write(unicornMessage);
	req.end();
}

function poll(functionName, callback) {
    const params = {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10,
    };
    // batch request messages
    SQS.receiveMessage(params, (err, data) => {
        if (err) {
            return callback(err);
        }
        // for each message, reinvoke the function
        const promises = data.Messages.map((message) => invokePoller(functionName, message));
        // complete when all invocations have been made
        Promise.all(promises).then(() => {
            const result = `Messages received: ${data.Messages.length}`;
            console.log(result);
            callback(null, result);
        });
    });
}

exports.handler = (event, context, callback) => {
    try {
        if (event.operation === PROCESS_MESSAGE) {
            // invoked by poller
            processMessage(event.message, callback);
        } else {
            // invoked by schedule
            poll(context.functionName, callback);
        }
    } catch (err) {
        callback(err);
    }
};
