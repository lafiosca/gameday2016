#!/usr/bin/env python
"""
Client which receives the requests

Args:
    API Token
    API Base (https://...)

"""
from flask import Flask, request
import logging
import argparse
import urllib2

import dynamo_post

# logging.basicConfig(level=logging.DEBUG)

# parsing arguments
PARSER = argparse.ArgumentParser(description='Client message processor')
PARSER.add_argument('API_token', help="the individual API token given to your team")
PARSER.add_argument('API_base', help="the base URL for the game API")

ARGS = PARSER.parse_args()

# defining global vars
MESSAGES = {} # A dictionary that contains message parts
API_BASE = ARGS.API_base
# 'https://csm45mnow5.execute-api.us-west-2.amazonaws.com/dev'

APP = Flask(__name__)

# creating flask route for type argument
@APP.route('/', methods=['GET', 'POST'])
def main_handler():
    """
    main routing for requests
    """
    if request.method == 'POST':
        return process_message(request.get_json())
    else:
        return get_message_stats()

def get_message_stats():
    """
    provides a status that players can check
    """
    msg_count = len(MESSAGES.keys())
    return "There are %d messages in the MESSAGES dictionary" % msg_count

def process_message(msg):
    """
    processes the messages by combining and appending the kind code
    """
    msg_id = msg['Id'] # The unique ID for this message

    total_parts = msg['TotalParts']

    if total_parts <= 0:
        print "received bad partial message:", msg
        return 'ERROR'

    part_number = msg['PartNumber'] # Which part of the message it is
    data = msg['Data'] # The data of the message

    # Try to get the parts of the message from the MESSAGES dictionary.
    # If it's not there, create one that has None as all parts
    result = dynamo_post.check_id(msg_id) # None if not found, data otherwise
    if result == 'NoKey':
        # Create new item
        dynamo_post.new_item(msg_id, total_parts)
        return 'OK'

    elif result == 'Exception':
        return 'OK'

    elif type(result) = type(' '):
        print('This should not be a string: "%s"' % result)
        return 'OK'

    # parts = MESSAGES.get(msg_id, [None] * total_parts)
    parts = result['data']

    if parts[part_number] != None:
        # Already have data, no need to update
        print('Already have data for this part')
        return 'OK'

    # store this part of the message in the correct part of the list
    parts[part_number] = data

    # store the parts in MESSAGES
    # MESSAGES[msg_id] = parts
    dynamo_post.update_item(msg_id, parts)

    # if both parts are filled, the message is complete
    if None not in parts:
        # app.logger.debug("got a complete message for %s" % msg_id)
        print "have both parts"
        # We can build the final message.
        result = ''.join(parts)
        # sending the response to the score calculator
        # format:
        #   url -> api_base/jFgwN4GvTB1D2QiQsQ8GHwQUbbIJBS6r7ko9RVthXCJqAiobMsLRmsuwZRQTlOEW
        #   headers -> x-gameday-token = API_token
        #   data -> EaXA2G8cVTj1LGuRgv8ZhaGMLpJN2IKBwC5eYzAPNlJwkN4Qu1DIaI3H1zyUdf1H5NITR
        APP.logger.debug("ID: %s" % msg_id)
        APP.logger.debug("RESULT: %s" % result)
        url = API_BASE + '/' + msg_id
        print url
        print result
        req = urllib2.Request(url, data=result, headers={'x-gameday-token':ARGS.API_token})
        resp = urllib2.urlopen(req)
        resp.close()
        print resp.getcode()

    return 'OK'

if __name__ == "__main__":

    # By default, we disable threading for "debugging" purposes.
    # This will cause the app to block requests, which means that you miss out on some points,
    # and fail ALB healthchecks, but whatever I know I'm getting fired on Friday.
    # APP.run(host="0.0.0.0", port="80")

    # Use this to enable threading:
    APP.run(host="0.0.0.0", port="80", threaded=True)
