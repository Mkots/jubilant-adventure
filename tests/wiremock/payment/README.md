# Payment WireMock contract

The image is pinned in `docker-compose.yml`. Each mapping requires the explicit `X-Payment-Scenario` header. The `replay` response derives its transaction ID from `Idempotency-Key`, so repeated requests are deterministic. The `timeout` mapping delays its response by 1500 ms; client tests use a shorter configured timeout.

The admin reset endpoint is `POST /__admin/mappings/reset` and request inspection is `GET /__admin/requests`. No mapping contains a real hostname or credential.
