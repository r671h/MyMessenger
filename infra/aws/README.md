# AWS deployment

ECS Fargate runs Next.js and one Express/Socket.IO backend behind an HTTPS ALB.
`/api/*`, `/socket.io/*` and `/uploads/*` go to the backend; other paths go to Next.js.
Both use the same public origin. Cloudinary continues storing media.

RDS PostgreSQL is private, encrypted, single-AZ, with seven days of backups and
deletion protection. Tasks use public subnets and outbound public IPs to avoid a
NAT Gateway; their inbound security group accepts traffic only from the ALB.
Application secrets are injected by ECS from Secrets Manager; they are never baked
into images. Use a same-region secret encrypted with the default Secrets Manager
key (a customer-managed KMS key requires additional execution-role permissions).

This is an initial deployment, not high availability. Keep exactly one backend:
presence and Socket.IO rooms are process-local. Backend deployments stop the old
task before starting the new one, so there is downtime and clients reconnect.
The deployment circuit breaker rolls back unhealthy tasks, but cannot undo schema
migrations. Migrations must remain compatible with the previous application version.
The RDS login initially owns the database and runs Prisma migrations; separating
migration and runtime database privileges is a later hardening step.

## Prerequisites

- AWS account and an authenticated AWS CLI v2 session with infrastructure permissions.
- Docker with a running daemon, or another trusted image builder.
- Public domain and an **issued ACM certificate in the deployment region**.
- Cloudinary account. Keep existing database data separate: this creates an empty
  database and applies the repository's migrations; it does not transfer existing data.

The examples below use **Bash** (WSL/Linux/macOS), not PowerShell. Substitute your
account and domain. Stockholm is the project region. Resources incur AWS charges:
Fargate tasks, ALB, RDS, public IPv4, logs, Secrets Manager and image storage.
No account-specific budget estimate or actual AWS provisioning has been performed.

## First deployment

On Windows, install AWS CLI v2, sign in (for example `aws configure sso`, then
`aws sso login --profile your-profile`), and start Docker Desktop. Create the
application secret and issued ACM certificate as described below, then run from
PowerShell (supply real resource ARNs):

```powershell
powershell -ExecutionPolicy Bypass -File infra/aws/deploy.ps1 `
  -DomainName chat.example.com -Region eu-north-1 -Profile your-profile `
  -CertificateArn arn:aws:acm:eu-north-1:123456789012:certificate/REPLACE `
  -AppSecretArn arn:aws:secretsmanager:eu-north-1:123456789012:secret:REPLACE
```

The script checks authentication, Docker and template validity before creating
resources, builds and pushes both images, deploys the app, and prints the DNS target.
Configure DNS and browser verification afterward; GitHub OIDC setup is below.
The following numbered steps are the equivalent manual Bash procedure.

1. Set non-secret configuration and verify the target account:

   ```bash
   export AWS_REGION=eu-north-1
   export AWS_DEFAULT_REGION="$AWS_REGION"
   export APP_DOMAIN=chat.example.com
   export CERTIFICATE_ARN=arn:aws:acm:eu-north-1:123456789012:certificate/REPLACE
   aws sts get-caller-identity
   export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   export REGISTRY="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
   export IMAGE_TAG="initial-$(git rev-parse --short HEAD)"
   ```

2. In the AWS Secrets Manager console, create a secret using the default encryption
   key. Supply JSON keys `JWT_SECRET` (a long random value),
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   Do not commit the values or put them into command history. Record its ARN:

   ```bash
   export APP_SECRET_ARN=arn:aws:secretsmanager:eu-north-1:123456789012:secret:REPLACE
   ```

3. Create registries, build and push both images **before** deploying the app:

   ```bash
   aws cloudformation validate-template --template-body file://infra/aws/registry.yaml
   aws cloudformation validate-template --template-body file://infra/aws/app.yaml
   aws cloudformation deploy --stack-name social-media-registry --template-file infra/aws/registry.yaml
   aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
   docker build --platform linux/amd64 -t "$REGISTRY/social-media-server:$IMAGE_TAG" server
   docker build --platform linux/amd64 --build-arg "NEXT_PUBLIC_API_URL=https://$APP_DOMAIN" -t "$REGISTRY/social-media-client:$IMAGE_TAG" client
   docker push "$REGISTRY/social-media-server:$IMAGE_TAG"
   docker push "$REGISTRY/social-media-client:$IMAGE_TAG"
   aws cloudformation deploy --stack-name social-media-app \
     --template-file infra/aws/app.yaml --capabilities CAPABILITY_IAM \
     --parameter-overrides ImageTag="$IMAGE_TAG" DomainName="$APP_DOMAIN" \
       CertificateArn="$CERTIFICATE_ARN" AppSecretArn="$APP_SECRET_ARN"
   aws cloudformation describe-stacks --stack-name social-media-app --query 'Stacks[0].Outputs' --output table
   ```

4. Point the hostname at `LoadBalancerDns` from stack outputs (Route 53 alias A,
   or a CNAME for a subdomain at another provider). After DNS propagates:

   ```bash
   curl --fail "https://$APP_DOMAIN/api/health"
   curl --fail --output /dev/null "https://$APP_DOMAIN/login"
   ```

   Verify registration/login, direct messages, group messages, online presence,
   reconnects and file uploads in a browser. Inspect the CloudWatch log group from
   stack outputs if health checks fail. Never log secrets or connection strings.

## GitHub deployment with OIDC

1. In IAM, configure or reuse the GitHub OIDC provider
   `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
   Do not create a second provider if one exists.
2. Deploy `github-oidc.yaml` using `CAPABILITY_IAM`. Supply `Repository=owner/repo`,
   `OidcProviderArn` and the five identically named outputs from the app stack:
   `ClusterName`, `ServerServiceName`, `ClientServiceName`, `ExecutionRoleArn`,
   `TaskRoleArn`. The resulting role can push these two repositories and update
   these two services; it cannot create infrastructure or read application secrets.
3. Use GitHub environment **Production** and restrict deployment branches to your
   trusted release branch. Set these environment variables:

   | Variable | Value |
   | --- | --- |
   | AWS_REGION | eu-north-1 |
   | AWS_DEPLOY_ROLE_ARN | DeployRoleArn output from OIDC stack |
   | ECS_CLUSTER | ClusterName output |
   | ECS_SERVER_SERVICE | ServerServiceName output |
   | ECS_CLIENT_SERVICE | ClientServiceName output |
   | APP_URL | https://chat.example.com (no trailing slash) |

4. Run **Deploy AWS** manually in GitHub Actions from the trusted branch. It builds
   immutable image tags, deploys the backend and then frontend, waits for stability,
   verifies the exact task revision (including circuit-breaker rollback detection),
   and checks the public endpoints. The image tag appears in the job summary.
   It intentionally does not run automatically on pushes.

Actions updates ECS task definitions outside CloudFormation. Before subsequent
infrastructure updates, pass the **latest successful Actions image tag** as
`ImageTag` to keep the template aligned with the live application. Keep previous
images for rollback. Do not reuse immutable tags; choose a fresh initial tag if you
rebuild. A partial release can leave the server updated and the client unchanged;
keep API changes backward compatible. For rollback, update both ECS services to
their previous task-definition revisions, then wait and recheck health.

## Operation and deletion

- Rotating an application secret requires forcing a new ECS deployment. Do not
  rotate the database secret alone: its value must match the RDS password.
- Review CloudWatch logs and RDS storage/connection metrics; configure alarms and
  an AWS Budget for your account before relying on this deployment in production.
- There is no backend autoscaling until shared presence and a Socket.IO adapter
  are implemented. The initial deployment does not include Redis.
- To delete the app, first explicitly disable RDS deletion protection through a
  stack update. Stack deletion snapshots the database and retains its password
  secret. Snapshots, secrets, ECR images and the separately created app secret can
  continue incurring charges; remove them only after verifying backup requirements.
- Infrastructure templates: [ECS secrets](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html),
  [Fargate task definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html).
