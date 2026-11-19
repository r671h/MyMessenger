# Run with PowerShell: pwsh -File infra/aws/deploy.ps1 -DomainName ... -CertificateArn ... -AppSecretArn ...
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9.-]+$')][string]$DomainName,
    [Parameter(Mandatory)][string]$CertificateArn,
    [Parameter(Mandatory)][string]$AppSecretArn,
    [string]$Region = 'eu-north-1',
    [string]$Profile,
    [string]$StackName = 'social-media-app'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$awsArguments = @('--region', $Region)
if ($Profile) { $awsArguments += @('--profile', $Profile) }

function Invoke-Aws {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    $result = & aws @awsArguments @Arguments
    if ($LASTEXITCODE -ne 0) { throw "AWS command failed: $($Arguments[0]) $($Arguments[1])" }
    return $result
}
function Invoke-Docker {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($Arguments[0])" }
}

Get-Command aws, docker -ErrorAction Stop | Out-Null
# Fail before creating any billable resources if authentication or Docker is unavailable.
$identity = (Invoke-Aws sts get-caller-identity --output json) | ConvertFrom-Json
Invoke-Docker info --format '{{.ServerVersion}}'
Write-Host "Deploying to AWS account $($identity.Account), region $Region, domain $DomainName"
Invoke-Aws acm describe-certificate --certificate-arn $CertificateArn --output json | Out-Null
Invoke-Aws secretsmanager describe-secret --secret-id $AppSecretArn --output json | Out-Null
foreach ($template in @('registry.yaml', 'app.yaml', 'github-oidc.yaml')) {
    Invoke-Aws cloudformation validate-template --template-body "file://$PSScriptRoot/$template" | Out-Null
}

$registry = "$($identity.Account).dkr.ecr.$Region.amazonaws.com"
$tag = 'release-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
Invoke-Aws cloudformation deploy --stack-name social-media-registry --template-file "$PSScriptRoot/registry.yaml"
# Pipe the short-lived token directly to Docker; never print it or write it to disk.
Invoke-Aws ecr get-login-password | & docker login --username AWS --password-stdin $registry
if ($LASTEXITCODE -ne 0) { throw 'ECR Docker login failed' }
Invoke-Docker build --platform linux/amd64 -t "$registry/social-media-server:$tag" "$repoRoot/server"
Invoke-Docker build --platform linux/amd64 --build-arg "NEXT_PUBLIC_API_URL=https://$DomainName" -t "$registry/social-media-client:$tag" "$repoRoot/client"
Invoke-Docker push "$registry/social-media-server:$tag"
Invoke-Docker push "$registry/social-media-client:$tag"
Invoke-Aws cloudformation deploy --stack-name $StackName --template-file "$PSScriptRoot/app.yaml" --capabilities CAPABILITY_IAM --parameter-overrides "ImageTag=$tag" "DomainName=$DomainName" "CertificateArn=$CertificateArn" "AppSecretArn=$AppSecretArn"
Invoke-Aws cloudformation describe-stacks --stack-name $StackName --query 'Stacks[0].Outputs' --output table
Write-Host "Deployed image tag: $tag"
Write-Host "Point DNS for $DomainName to LoadBalancerDns above, then verify https://$DomainName/api/health and browser messaging."
