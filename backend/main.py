# Copyright © 2021, United States Government, as represented by the Administrator of the
# National Aeronautics and Space Administration. All rights reserved.
#
# The “ISAAC - Integrated System for Autonomous and Adaptive Caretaking platform” software is
# licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
#
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the
# License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied. See the License for the specific language governing
# permissions and limitations under the License.
#
# ------------------------------------------------------------------------------------------
# ISAAC Interface
# Backend API
# ------------------------------------------------------------------------------------------

import json
import sys
from time import time

from database import Database
from flask import Flask, abort
from ros_connection import ROSConnection


def log(message):
    print("[{}] {}".format(int(time()), message))
    sys.stdout.flush()


log("opening config")
# Load yaml configuration file
with open("/config.json", "r", encoding="utf-8") as f:
    configuration = json.load(f)
log("config loaded")

# Flask application (API)
app = Flask(__name__)

log("establishing db conn")
# Database connection
database_connection = Database()
log("db conn established")

log("establishing ros bridge conn")
# ROS bridge connection
ros_connection = ROSConnection(
    database_connection=database_connection,
    configuration=configuration,
)
log("ros bridge conn established")


def unsluggify_ros_topic(ros_topic):
    # warning! we can't use ros topic names in URLs (because
    # they use forward slashes) therefore we have to "sluggify" them
    #
    # this is a simple process:
    # 1. remove prefixed /
    # 2. replace any other / with two _
    #
    return "/" + ros_topic.replace("__", "/")


@app.route("/config.json")
def config_request():
    # this enables hot reconfigurations to occur
    # because it will re-read the config.json file
    # on each API call (i.e.: if you change your config
    # you just need to refresh the frontend page)
    global configuration
    with open("/config.json", "r", encoding="utf-8") as f:
        configuration = json.load(f)
    return json.dumps(configuration), 200, {"Content-Type": "application/json"}


@app.route("/history/<ros_topic>/start/<start_time>/end/<end_time>")
def history_time_bound(ros_topic, start_time, end_time):
    start_time, end_time = int(float(start_time)), int(float(end_time))

    ros_topic = unsluggify_ros_topic(str(ros_topic))

    if end_time <= start_time:
        abort(400)

    if ros_topic not in ros_connection.available_ros_topics:
        abort(404)

    result = database_connection.load(
        ros_topic=ros_topic,
        start_time=start_time,
        end_time=end_time,
    )

    return json.dumps(result)


@app.route("/topics")
def ros_topic_list():
    return json.dumps(ros_connection.available_ros_topics)


if __name__ == "__main__":
    print("Launching IUI Backend with the following configuration:")
    print(configuration)
    print("\n")

    app.run(debug=True, host="0.0.0.0", port=9091)
