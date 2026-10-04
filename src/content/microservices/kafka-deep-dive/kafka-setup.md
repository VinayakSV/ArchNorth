# Kafka Setup — Run on Your Laptop (Windows & Mac)

## Option A: Docker Compose (Recommended)

<div class="callout-info">

**Prerequisites**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows or Mac. That's all you need.

</div>

Create a file called `docker-compose.yml` anywhere on your machine:

```yaml
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
```

### Start & Stop

```bash
# Start (Windows PowerShell / CMD / Mac Terminal — same command)
docker-compose up -d

# Verify
docker-compose ps

# Open Kafka UI → http://localhost:8080

# Stop
docker-compose down
```

---

## Option B: KRaft Mode (No Zookeeper — Kafka 3.3+)

```yaml
version: '3.8'
services:
  kafka:
    image: apache/kafka:3.7.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      CLUSTER_ID: "MkU3OEVBNTcwNTJENDM2Qk"
```

---

## CLI Commands — Try It Now

### Create a topic

```bash
docker exec -it <kafka-container-name> bash

kafka-topics --create --topic orders --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
kafka-topics --list --bootstrap-server localhost:9092
kafka-topics --describe --topic orders --bootstrap-server localhost:9092
```

### Produce messages

```bash
kafka-console-producer --topic orders --bootstrap-server localhost:9092

> {"orderId": 1, "item": "laptop", "amount": 999}
> {"orderId": 2, "item": "phone", "amount": 699}
```

### Consume messages

```bash
# New terminal
kafka-console-consumer --topic orders --bootstrap-server localhost:9092 --from-beginning

# With consumer group
kafka-console-consumer --topic orders --bootstrap-server localhost:9092 --group order-processors
```

### Produce with keys

```bash
kafka-console-producer --topic orders --bootstrap-server localhost:9092 --property "parse.key=true" --property "key.separator=:"

> user-123:{"orderId": 1, "item": "laptop"}
> user-456:{"orderId": 2, "item": "phone"}
> user-123:{"orderId": 3, "item": "case"}
```

---

## 5-Minute Exercise

<div class="step">

**Step 1**: Start Kafka with `docker-compose up -d`

</div>

<div class="step">

**Step 2**: Open 3 terminal windows

</div>

<div class="step">

**Step 3**: Terminal 1 — Create topic: `kafka-topics --create --topic chat --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1`

</div>

<div class="step">

**Step 4**: Terminal 2 — Start consumer: `kafka-console-consumer --topic chat --bootstrap-server localhost:9092 --group readers --property print.key=true --property print.partition=true`

</div>

<div class="step">

**Step 5**: Terminal 3 — Start producer with keys, send messages. Watch them arrive in Terminal 2.

</div>

<div class="step">

**Step 6**: Open a 4th terminal, start another consumer in the SAME group. Send more messages — notice partitions split between consumers.

</div>

<div class="step">

**Step 7**: Open Kafka UI at `http://localhost:8080` — explore topics, messages, consumer lag.

</div>
