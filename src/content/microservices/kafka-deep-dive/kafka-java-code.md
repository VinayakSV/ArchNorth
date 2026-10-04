# Kafka — Java Producer & Consumer Code

## Maven Dependency

```xml
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-clients</artifactId>
    <version>3.7.0</version>
</dependency>
```

---

## Producer

```java
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import java.util.Properties;

public class OrderProducer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "all");
        props.put(ProducerConfig.RETRIES_CONFIG, 3);
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

        try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
            for (int i = 1; i <= 10; i++) {
                String key = "user-" + (i % 3);
                String value = "{\"orderId\":" + i + ",\"amount\":" + (i * 100) + "}";

                producer.send(new ProducerRecord<>("orders", key, value), (metadata, ex) -> {
                    if (ex == null) {
                        System.out.printf("Sent → partition %d, offset %d%n",
                            metadata.partition(), metadata.offset());
                    } else {
                        ex.printStackTrace();
                    }
                });
            }
        }
    }
}
```

<div class="callout-scenario">

**What's happening**: We send 10 orders keyed by userId. Users 0, 1, 2 will each land on a consistent partition. The `acks=all` + idempotence ensures no message is lost or duplicated.

</div>

---

## Consumer

```java
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.serialization.StringDeserializer;
import java.time.Duration;
import java.util.List;
import java.util.Properties;

public class OrderConsumer {
    public static void main(String[] args) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "order-processors");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false); // manual commit

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            consumer.subscribe(List.of("orders"));

            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(1000));
                for (ConsumerRecord<String, String> record : records) {
                    System.out.printf("Partition: %d | Offset: %d | Key: %s | Value: %s%n",
                        record.partition(), record.offset(), record.key(), record.value());
                }
                if (!records.isEmpty()) {
                    consumer.commitSync(); // commit after processing
                }
            }
        }
    }
}
```

---

## Spring Boot (Simpler)

### application.yml

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: order-processors
      auto-offset-reset: earliest
```

### Producer

```java
@Service
public class OrderEventPublisher {
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    public void publishOrderCreated(String userId, String orderJson) {
        kafkaTemplate.send("orders", userId, orderJson);
    }
}
```

### Consumer

```java
@Service
public class OrderEventListener {
    @KafkaListener(topics = "orders", groupId = "order-processors")
    public void handleOrder(ConsumerRecord<String, String> record) {
        System.out.printf("Received: key=%s, value=%s, partition=%d%n",
            record.key(), record.value(), record.partition());
    }
}
```

---

## Exactly-Once Transactions

```java
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "order-producer-1");

producer.initTransactions();
try {
    producer.beginTransaction();
    producer.send(new ProducerRecord<>("orders", key, value));
    producer.send(new ProducerRecord<>("audit-log", key, auditValue));
    producer.commitTransaction();  // both or neither
} catch (Exception e) {
    producer.abortTransaction();
}
```

<div class="callout-info">

**When to use transactions**: When you need to write to multiple topics atomically. For example, writing an order event AND an audit log event — either both succeed or neither does.

</div>
