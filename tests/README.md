
# NASA ISAAC User Interface

[![GitHub license](https://img.shields.io/github/license/nasa/isaac_user_interface)](https://github.com/nasa/isaac_user_interface/blob/master/LICENSE)

### This section contains multiple comprehensive tests that ensure the ISAAC UI is able to run without any errors or warnings in multiple scenarios and with different types of ROS simulations.

---

| Type of test                     | Name of test                                  | Status        |
|----------------------------------|-----------------------------------------------|---------------|
| Without a ROS simulation         | Using localhost ROS Master node               | PASS          |
|                                  | Using an external ROS Master node             | UNIMPLEMENTED |
|                                  | Letting the UI launch its own ROS Master node | PASS          |
| With a NASA built ROS simulation | Astrobee sim within Docker                    | PASS          |
|                                  | Astrobee sim running natively                 | UNKNOWN       |
|                                  | ISAAC sim within Docker                       | PASS          |
|                                  | ISAAC sim running natively                    | UNKNOWN       |
| With an external ROS simulation  | Turtlebot sim within Docker                   | UNIMPLEMENTED |
|                                  | Turtlebot sim running natively                | UNIMPLEMENTED |
|                                  | Turtlebot sim running on another computer     | UNIMPLEMENTED |