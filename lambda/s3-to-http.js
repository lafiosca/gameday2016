'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const http = require('http');

exports.handler = (event, context, callback) => {
	const bucket = event.Records[0].s3.bucket.name;
	const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
	const params = {
		Bucket: bucket,
		Key: key,
	};

	s3.getObject(params, (err, data) => {
		if (err) {
			console.log(err);
			const message = `Error getting object ${key} from bucket ${bucket}.`;
			console.log(message);
			return callback(message);
		}

		let unicornMessage = data.Body.toString('utf-8');
		console.log(`Received message: ${unicornMessage}`);

		let options = {
			hostname: process.env.UNICORN_HOST,
			port: 80,
			path: '/',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
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
				callback(null, body);
			});
		});

		req.on('error', callback);

		req.write(unicornMessage);
		req.end();
	});
};
