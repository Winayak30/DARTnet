package com.nexussoc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class NexusSocApplication {
    public static void main(String[] args) {
        SpringApplication.run(NexusSocApplication.class, args);
    }
}
