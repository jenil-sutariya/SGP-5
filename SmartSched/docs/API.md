# API Reference

Interactive docs: `GET /api/docs`  
OpenAPI JSON: `GET /api/docs.json`

All versioned endpoints live under `/api/v1`.

Authenticate with:

```
Authorization: Bearer <accessToken>
```

Standard envelope:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 100 } }
}
```

See Swagger for request/response schemas per module.
