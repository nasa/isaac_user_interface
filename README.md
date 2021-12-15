
# NASA ISAAC User Interface

[![GitHub license](https://img.shields.io/github/license/nasa/isaac)](https://github.com/nasa/isaac/blob/master/LICENSE)

### The NASA ISAAC UI is a full-fledged web-based user interface system for ROS projects. It provides a pre-configured frontend, backend, and database that allow monitoring and control of robots built using ROS.

---

![Example screenshot of ISAAC UI](isaac_ui.jpg)

---

## Quick Start

   Clone the ISAAC UI repository:

   `git clone https://github.com/nasa/isaac_user_interface.git`

   Build the ISAAC UI:

   `./build.sh`

   Run the ISAAC UI:

   `./run.sh`

   Check the status of the ISAAC UI:

   `./status.sh`

   Shutdown the ISAAC UI:

   `./shutdown.sh`

---

## Prerequisites

To build and run the ISAAC UI you must have installed:

- [Docker](https://docs.docker.com/engine/install/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [ROS Melodic](http://wiki.ros.org/melodic/Installation) or [ROS Noetic](http://wiki.ros.org/noetic/Installation)

You might already have the prerequisites installed. Verify this:

```bash
   docker --version
   docker-compose --version
   rosversion ros
```

Clone the ISAAC UI repository locally:

```
   git clone https://github.com/nasa/isaac_user_interface.git
   cd isaac_user_interface
```

The ISAAC UI assumes you have a ROS master node, but will run a master node for you should that not be the case.

```bash
   ./build.sh  # this may take 5 - 10 minutes

   ./run.sh  # now the UI is running at http://localhost:8080

   ./status.sh  # check the status of each subsystem

   ./shutdown.sh  # shutdown the UI 
```

---

## Architecture

![Simplified architectural diagram of ISAAC UI](isaac_ui_diagram.png)

---

## Debugging

If you get a permissions error when running a Docker script, you can either:

1. Run the scripts (.sh files) as root (preprend sudo to each command); OR
2. Add your linux user to the docker user group:

```
   sudo usermod -aG docker $USER
   newgrp docker
```

Read more about Docker's post installation steps [here](https://docs.docker.com/engine/install/linux-postinstall/).

---

## License

Copyright (c) 2021, United States Government, as represented by the Administrator of the National Aeronautics and Space Administration. All rights reserved.

The "ISAAC - Integrated System for Autonomous and Adaptive Caretaking platform" software is licensed under the Apache License, Version 2.0 "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.