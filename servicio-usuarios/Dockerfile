# Neptuno · servicio-usuarios (ms-auth-catalogs)
# Build multi-etapa: compila con Maven + JDK 21 y ejecuta solo el JRE.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S neptuno && adduser -S neptuno -G neptuno
COPY --from=build /build/target/servicio-usuarios-*.jar /app/servicio-usuarios.jar
USER neptuno
EXPOSE 8081
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70"
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
    CMD wget -qO- http://127.0.0.1:8081/actuator/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/servicio-usuarios.jar"]
