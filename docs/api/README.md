# API documentation

The [API design document](../design/api_desing.md) describes the implemented API:
endpoint catalogue, browser/backend boundaries, request/response examples,
authorization, pagination, errors, and workflow rules.

The backend serves its generated schema at `/api/v1/openapi.json`, with interactive
documentation at `/docs` and `/redoc` when the backend is directly reachable.
These backend paths are not necessarily exposed on the public frontend origin.

The [LLD endpoint map](../design/LLD.md#feature-module-boundaries-and-routes)
retains some older proposed routes. Use implemented routers, their schemas/tests,
and the implementation-aligned API design document when integrating current APIs.
