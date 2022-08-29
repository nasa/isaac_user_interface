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
# -------------------------------------------------------------------------------------------
# ISAAC Interface
# Backend API
# -------------------------------------------------------------------------------------------
# ROS Connection class definition file
# For reference, see:
# https://roslibpy.readthedocs.io/en/latest/
# -------------------------------------------------------------------------------------------

import os
import time

import roslibpy


class ROSConnection:
    def __init__(self, database_connection, configuration):
        self.database_connection = database_connection
        self.configuration = configuration

        self.ros = roslibpy.Ros(
            host=os.getenv("ROS_BRIDGE_IP", "rosbridge"),
            port=int(os.getenv("ROS_BRIDGE_PORT", "9090")),
        )
        while True:
            try:
                self.ros.run()
                break
            except Exception as e:
                print("[error] could not connect to rosbridge, will try again")
                time.sleep(5)

        assert self.ros.is_connected

        # keep track of ROS subscriptions and callbacks
        self.subscribers = []

        # list of all ROS topics available to sub/pub from/to
        self.available_ros_topics = []

        # fix ros message type for all log objects
        for i, j in enumerate(self.configuration["logs"]):
            if not ("type" in j["ros"]):
                self.configuration["logs"][i]["ros"]["type"] = "rosgraph_msgs/Log"

        for topic_config in (
            self.configuration["telemetry"] + self.configuration["logs"]
        ):
            topic_name, topic_type = (
                topic_config["ros"]["topic"],
                topic_config["ros"]["type"],
            )

            # check if topic has already been subscribed to
            if topic_name in self.available_ros_topics:
                continue

            self.available_ros_topics.append(topic_name)
            self.subscribe(
                ros_topic=topic_name,
                message_type=topic_type,
            )

    def close(self):
        self.ros.terminate()

    def callback(self, message, ros_topic):
        # TODO this is temporary, fix this
        # ideally the time should be correct from the Astrobee sim
        time_now = int(time.time()) * 1000

        try:
            # this is a temporary fix to the message timestamp
            message["header"]["stamp"]["secs"] = time_now
        except KeyError:
            # the header doesn't exist so we will add it manually
            message["header"] = {"stamp": {"secs": time_now}}

        self.database_connection.save(message=message, ros_topic=ros_topic)

    def subscribe(self, ros_topic, message_type):
        print("Subscribing to topic " + ros_topic + " of type " + message_type)

        # use a roslibpy topic to subscribe to the ros topic
        self.subscribers.append(
            roslibpy.Topic(
                self.ros,
                ros_topic,
                message_type,
                throttle_rate=1000,  # 1000 ms between messages, so we sub at 1 Hz
            )
        )

        # create an index for this topic in our database
        self.database_connection.pre_save(ros_topic=ros_topic)

        # register callback for this ros topic
        self.subscribers[-1].subscribe(
            lambda x: self.callback(message=x, ros_topic=ros_topic)
        )
