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
# Database interface class definition
# -------------------------------------------------------------------------------------------

# roslibpy needs a logger in order to output errors inside callbacks
import logging
from time import sleep

import pyArango.connection as pac
import requests.exceptions as rex

logging.basicConfig()


class Database:
    def __init__(self):
        # Initiate the connection to http://iui_arangodb:8529
        print("Database: Initiating connection")

        sleep(5)

        # Try to connect to the database 600 times, sleeping 1 second between each try
        # This is done because the database process takes a few seconds to begin responding
        # to HTTP requests
        self.conn = None
        for _ in range(600):
            try:
                self.conn = pac.Connection(
                    arangoURL="http://iui_arangodb:8529",
                    username="root",
                    password="isaac",
                    max_retries=1,
                )
                break
            except rex.ConnectionError:
                print(
                    "Database couldn't be reached; sleeping for 1 second before retrying"
                )
                sleep(1)
        if self.conn is None:
            raise rex.ConnectionError

        # Open the database
        if not self.conn.hasDatabase("isaac"):
            self.conn.createDatabase(name="isaac")
        self.db = self.conn["isaac"]

    # This function is called every time we subscribe to a new topic
    def pre_save(self, ros_topic):
        ros_topic = ros_topic.replace("/", "_")[1:]
        # ros_topic is now a Collection
        print("Creating collection " + ros_topic)
        if not self.db.hasCollection(ros_topic):
            self.db.createCollection(name=ros_topic)
        # ensure index
        self.db[ros_topic].ensureSkiplistIndex(["header.stamp.secs"])

    # This function is called every time we get a new message
    def save(self, message, ros_topic):
        ros_topic = ros_topic.replace("/", "_")[1:]
        # Save the message
        aql = (
            "INSERT "
            + str(message)
            + " INTO "
            + ros_topic
            + " LET newDoc = NEW RETURN newDoc"
        )
        self.db.AQLQuery(aql)

    def load(self, ros_topic, start_time=None, end_time=None):
        # warning! timestamps are in milliseconds since epoch, not seconds
        aql = ""
        if start_time is not None and end_time is not None:
            ros_topic = ros_topic.replace("/", "_")[1:]

            aql = (
                "FOR doc IN "
                + ros_topic
                + "\n"
                + "\tFILTER doc.header.stamp.secs >= "
                + str(start_time)
                + " AND doc.header.stamp.secs <= "
                + str(end_time)
                + "\n"
                + "\tRETURN doc"
            )

        result = list(self.db.AQLQuery(aql, rawResults=True))
        return result
