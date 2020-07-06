# Starting REDIS

* The game server requires a running instance of [redis](https://redis.io/) to work.
* It is recommended to run it from the offical [docker image](https://hub.docker.com/_/redis).

### Starting **redis**
* `redis.conf`
```
port 6380
```

* `redis.sh`
```
#!/bin/bash

docker rm -f redb
sleep 2
docker run --name redb -p 6379:6379 -itd redis
```

* `>crontab -e`
@reboot /{path}/redis.sh

### Accessing **redis** container running inside a Linux VM on a Windows host
* If using Windows machine, it is common to run docker containers in a Linux VM
* Networking setup can be tricky
* Using VirtualBox as an example

1. Start VirtualBox Manager, select the Linux VM, go to Settings `->` Network `->` Advanced `->` Port Forwarding
1. Add the rule `REDIS | TCP | - | 6379 | - | 6379`
1. Access the **redis** instance via `127.0.0.1:6379`
