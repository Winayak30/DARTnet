FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN apk add --no-cache curl

EXPOSE 8080

# JVM tuning:
#   -Xms256m / -Xmx512m  — bounded heap so container doesn't OOM
#   UseContainerSupport   — respects Docker memory limits (default in JDK17, explicit for clarity)
#   G1GC                  — better pause times than default serial GC in Alpine
#   ExitOnOutOfMemoryError — crash fast so Docker restart policy recovers us
ENTRYPOINT ["java", \
  "-Xms256m", "-Xmx512m", \
  "-XX:+UseContainerSupport", \
  "-XX:+UseG1GC", \
  "-XX:MaxGCPauseMillis=200", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
