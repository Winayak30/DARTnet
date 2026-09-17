package com.dartnet;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DartNetApplication {
    public static void main(String[] args) {
        SpringApplication.run(DartNetApplication.class, args);
    }
}
