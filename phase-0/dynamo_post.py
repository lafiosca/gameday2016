#!/usr/bin/env python
"""
Client which receives the requests
"""

from __future__ import print_function # Python 2/3 compatibility
import boto3
import json
import decimal

# Helper class to convert a DynamoDB item to JSON.
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            if o % 1 > 0:
                return float(o)
            else:
                return int(o)
        return super(DecimalEncoder, self).default(o)


dynamodb = boto3.resource('dynamodb', region_name='eu-central-1', endpoint_url="https://dynamodb.eu-central-1.amazonaws.com")
table = dynamodb.Table('timtamslam')

def check_id(id):
	""" Returns data if Id exists in DB, None otherwise"""
	try:
		response = table.get_item(
			Key={
				'Id': id
			})
		
	except Exception as e:
		print(e)
		return 'Exception'
	else:
		if not response.has_key('Item'):
			return 'NoKey'
		item = response['Item']
		print(response['Item'])
		return response['Item']
		
def new_item(id, num_parts):
	return update_item(id, [None] * num_parts)

def update_item(id, parts):
	response = table.put_item(
		Item = {
			'data': parts,
			'Id':	id
		}
	)
	print("PutItem succeeded:")
	print(json.dumps(response, indent=4, cls=DecimalEncoder))
	return



"""
id = "fake_id_101"
data = [None,None]

response = table.put_item(
   Item={
        'data': data,
        'Id': id,
        'posted': 0
    }
)

print("PutItem succeeded:")
print(json.dumps(response, indent=4, cls=DecimalEncoder))
"""

