# Infrastructure and Deployment

## Deployment Strategy

- **Frontend:** Static hosting (e.g., AWS S3 + CloudFront)
- **Backend:** Existing agent deployment
- **CI/CD:** GitHub Actions for frontend builds

## Security Considerations

- Client-side validation
- No permanent file storage
- Rate limiting
- HTTPS encryption
